package main

import (
	"context"
	"fmt"
	"io"
	"kingo/internal/app"
	"kingo/internal/auth"
	"kingo/internal/clipboard"
	"kingo/internal/config"
	"kingo/internal/downloader"
	"kingo/internal/events"
	"kingo/internal/handlers"
	"kingo/internal/images"
	"kingo/internal/launcher"
	"kingo/internal/logger"
	"kingo/internal/roadmap"
	"kingo/internal/storage"
	"kingo/internal/telemetry"
	"kingo/internal/updater"
	"kingo/internal/whisper"
	"kingo/internal/youtube"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// proxyHTTPClient is a shared HTTP client for the proxy server.
// Reused across requests to leverage connection pooling and avoid per-request allocations.
var proxyHTTPClient = &http.Client{
	Timeout: 60 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        10,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  true, // streams are already compressed
		MaxConnsPerHost:     5,
	},
}

// Version is set at build time via ldflags, or read from the embedded VERSION file.
var Version string

// App struct is the Facade that exposes methods to the Frontend.
type App struct {
	ctx          context.Context
	paths        *app.Paths
	db           *storage.DB
	downloadRepo *storage.DownloadRepository
	cfg          *config.Config

	launcher         *launcher.Launcher
	youtube          *youtube.Client
	downloadManager  *downloader.Manager
	updater          *updater.Updater
	imageClient      *images.Client
	clipboardMonitor *clipboard.Monitor
	telemetry        *telemetry.Service
	roadmap          *roadmap.Service
	auth             *auth.AuthService

	videoHandler       *handlers.VideoHandler
	mediaHandler       *handlers.MediaHandler
	settingsHandler    *handlers.SettingsHandler
	systemHandler      *handlers.SystemHandler
	converterHandler   *handlers.ConverterHandler
	transcriberHandler *handlers.TranscriberHandler
	whisperClient      *whisper.Client

	// Stream proxy server for video trimmer preview
	proxyServer   *http.Server
	proxyPort     int
	proxyMu       sync.Mutex
	proxyStreamURL string
}

// NewApp creates a new App application struct
func NewApp(appIcon []byte) *App {
	return &App{
		clipboardMonitor: clipboard.NewMonitor(appIcon),
		roadmap:          roadmap.NewService("down-kingo", "downkingo"),
	}
}

// ServiceStartup is called when the app starts (Wails v3 lifecycle)
func (a *App) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	a.ctx = ctx

	// Initialize paths
	paths, err := app.GetPaths()
	if err != nil {
		logger.Log.Error().Err(err).Msg("failed to get paths")
		return err
	}
	a.paths = paths

	// Initialize Auth Service
	a.auth = auth.NewAuthService(paths.AppData)

	// Connect auth token to roadmap service (enables Projects API when authenticated)
	a.roadmap.SetTokenProvider(func() string {
		return a.auth.Token
	})

	// Load Configuration
	cfg, err := config.Load(paths.AppData)
	if err != nil {
		logger.Log.Warn().Err(err).Msg("failed to load config, using defaults")
		cfg = config.Default()
	}
	a.cfg = cfg

	if cfg.DownloadsPath != "" && cfg.VideoDownloadPath == "" {
		cfg.VideoDownloadPath = cfg.DownloadsPath
	}
	if cfg.DownloadsPath != "" && cfg.ImageDownloadPath == "" {
		cfg.ImageDownloadPath = cfg.DownloadsPath
	}

	// Initialize logger
	if err := logger.Init(paths.AppData); err != nil {
		// Logger not available yet, use fmt
		fmt.Printf("Warning: failed to initialize logger: %v\n", err)
	}

	logger.Log.Info().
		Str("version", Version).
		Str("binDir", paths.Bin).
		Str("downloadsDir", paths.Downloads).
		Str("imagesDir", paths.Images).
		Msg("kingo starting up")

	// Ensure directories exist
	if err := paths.EnsureDirectories(); err != nil {
		logger.Log.Error().Err(err).Msg("failed to create directories")
		return err
	}

	// Initialize SQLite database
	db, err := storage.New(paths.AppData)
	if err != nil {
		logger.Log.Error().Err(err).Msg("failed to initialize database")
		return err
	}
	a.db = db
	a.downloadRepo = storage.NewDownloadRepository(db)
	logger.Log.Info().Msg("database initialized")

	// Configure RoadmapService with SQLite cache and event emitter
	a.roadmap.SetDB(db.Conn())
	a.roadmap.SetContext(ctx)
	a.roadmap.SetEventEmitter(func(eventName string, data interface{}) {
		application.Get().Event.Emit(eventName, data)
	})
	a.roadmap.ApplyConfig(cfg.GetRoadmapConfig()) // Apply CDN settings from config/env

	// Initialize internal services
	a.launcher = launcher.NewLauncher(paths.Bin)
	a.launcher.SetContext(ctx)

	a.youtube = youtube.NewClient(paths.YtDlpPath(), paths.FFmpegPath(), paths.Downloads)
	a.youtube.SetContext(ctx)
	a.youtube.SetAria2Path(paths.Aria2cPath())

	a.downloadManager = downloader.NewManager(a.downloadRepo, a.youtube, 3)
	a.downloadManager.SetContext(ctx)
	a.downloadManager.Start()
	logger.Log.Info().Msg("download manager started")

	a.updater = updater.NewUpdater(Version)
	a.updater.SetContext(ctx)

	a.telemetry = telemetry.NewService(cfg, Version)
	a.telemetry.TrackAppStart()

	a.imageClient = images.NewClient()

	// Initialize handlers with dependencies
	a.initializeHandlers(ctx)

	// Start Clipboard Monitor if enabled in config
	if a.cfg.ClipboardMonitorEnabled {
		a.startClipboardMonitor(ctx)
	}

	// Check for deep link on cold start
	for _, arg := range os.Args {
		if strings.HasPrefix(arg, "kingo://") {
			logger.Log.Info().Str("url", arg).Msg("processing deep link from cold start")
			application.Get().Event.Emit("deep-link", arg)
			break
		}
	}

	// Emit app:ready event to frontend with setup status
	needsSetup := a.NeedsDependencies()
	application.Get().Event.Emit("app:ready", map[string]interface{}{
		"needsSetup": needsSetup,
	})
	logger.Log.Info().Bool("needsSetup", needsSetup).Msg("app:ready event emitted")

	return nil
}

// startClipboardMonitor handles the start logic
func (a *App) startClipboardMonitor(ctx context.Context) {
	a.clipboardMonitor.Start(ctx)
	logger.Log.Info().Msg("Clipboard monitor started via config")
}

// initializeHandlers creates and configures all business logic handlers.
func (a *App) initializeHandlers(ctx context.Context) {
	a.videoHandler = handlers.NewVideoHandler(a.youtube, a.downloadManager,
		handlers.WithContext(ctx),
		handlers.WithConsoleEmitter(a.consoleLog),
	)

	a.mediaHandler = handlers.NewMediaHandler(a.imageClient, a.youtube)
	a.mediaHandler.SetContext(ctx)
	a.mediaHandler.SetConsoleEmitter(a.consoleLog)

	a.settingsHandler = handlers.NewSettingsHandler(a.cfg, a.youtube)
	a.settingsHandler.SetContext(ctx)

	a.systemHandler = handlers.NewSystemHandler(a.paths, a.launcher, a.updater)
	a.systemHandler.SetContext(ctx)
	a.systemHandler.SetConsoleEmitter(a.consoleLog)

	a.converterHandler = handlers.NewConverterHandler(a.paths)
	a.converterHandler.SetContext(ctx)
	a.converterHandler.SetConsoleEmitter(a.consoleLog)

	a.whisperClient = whisper.NewClient(a.paths.WhisperDir())
	a.transcriberHandler = handlers.NewTranscriberHandler(a.paths, a.whisperClient)
	a.transcriberHandler.SetContext(ctx)
	a.transcriberHandler.SetConsoleEmitter(a.consoleLog)
}

// consoleLog emits a user-friendly message to the frontend console.
func (a *App) consoleLog(message string) {
	application.Get().Event.Emit(events.ConsoleLog, message)
}

// startProxyServer starts a local HTTP proxy server for streaming video to the frontend trimmer.
// It proxies the direct stream URL (from yt-dlp) to avoid CORS/Referer issues in WebView.
func (a *App) startProxyServer() {
	a.proxyMu.Lock()
	defer a.proxyMu.Unlock()

	if a.proxyServer != nil {
		return // Already running
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/proxy/stream", func(w http.ResponseWriter, r *http.Request) {
		a.proxyMu.Lock()
		streamURL := a.proxyStreamURL
		a.proxyMu.Unlock()

		if streamURL == "" {
			http.Error(w, "no stream URL configured", http.StatusBadRequest)
			return
		}

		// Create request to the actual stream
		req, err := http.NewRequestWithContext(r.Context(), "GET", streamURL, nil)
		if err != nil {
			http.Error(w, "failed to create request", http.StatusInternalServerError)
			return
		}

		// Forward Range header for seeking support
		if rangeHeader := r.Header.Get("Range"); rangeHeader != "" {
			req.Header.Set("Range", rangeHeader)
		}

		resp, err := proxyHTTPClient.Do(req)
		if err != nil {
			http.Error(w, "failed to fetch stream", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		// Copy response headers
		w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
		if cl := resp.Header.Get("Content-Length"); cl != "" {
			w.Header().Set("Content-Length", cl)
		}
		if cr := resp.Header.Get("Content-Range"); cr != "" {
			w.Header().Set("Content-Range", cr)
		}
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
	})

	// Find available port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		logger.Log.Error().Err(err).Msg("failed to start proxy server")
		return
	}

	a.proxyPort = listener.Addr().(*net.TCPAddr).Port
	a.proxyServer = &http.Server{Handler: mux}

	go func() {
		if err := a.proxyServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			logger.Log.Error().Err(err).Msg("proxy server error")
		}
	}()

	logger.Log.Info().Int("port", a.proxyPort).Msg("stream proxy server started")
}

// GetStreamURL extracts the stream URL and returns a local proxy URL for the frontend.
// Returns the proxy URL (http://127.0.0.1:PORT/proxy/stream) for CORS-free video preview.
func (a *App) GetStreamURL(url string, format string) (string, error) {
	streamURL, err := a.videoHandler.GetStreamURL(url, format)
	if err != nil {
		return "", err
	}

	// Start proxy server if not running
	a.startProxyServer()

	// Store the stream URL for the proxy to use
	a.proxyMu.Lock()
	a.proxyStreamURL = streamURL
	a.proxyMu.Unlock()

	proxyURL := fmt.Sprintf("http://127.0.0.1:%d/proxy/stream", a.proxyPort)
	return proxyURL, nil
}

// SetStreamURL registers a direct stream URL in the proxy without invoking yt-dlp.
// Used when the frontend already has a valid stream URL (e.g., from videoInfo.formats).
// This is instant because it skips the yt-dlp extraction step entirely.
func (a *App) SetStreamURL(directURL string) (string, error) {
	if directURL == "" {
		return "", fmt.Errorf("empty stream URL")
	}

	// Start proxy server if not running
	a.startProxyServer()

	// Store the stream URL for the proxy to use
	a.proxyMu.Lock()
	a.proxyStreamURL = directURL
	a.proxyMu.Unlock()

	proxyURL := fmt.Sprintf("http://127.0.0.1:%d/proxy/stream", a.proxyPort)
	return proxyURL, nil
}

// GetVideoInfo delegates to videoHandler
func (a *App) GetVideoInfo(url string) (*youtube.VideoInfo, error) {
	return a.videoHandler.GetVideoInfo(url)
}

func (a *App) UpdateYtDlp(channel string) (string, error) {
	return a.videoHandler.UpdateYtDlp(channel)
}

func (a *App) Download(opts youtube.DownloadOptions) error {
	return a.videoHandler.Download(opts)
}

func (a *App) AddToQueue(url string, format string, audioOnly bool) (*storage.Download, error) {
	return a.videoHandler.AddToQueue(url, format, audioOnly)
}

func (a *App) AddToQueueAdvanced(opts youtube.DownloadOptions) (*storage.Download, error) {
	return a.videoHandler.AddToQueueAdvanced(opts)
}

func (a *App) GetDownloadQueue() ([]*storage.Download, error) {
	return a.videoHandler.GetDownloadQueue()
}

func (a *App) GetDownloadHistory(limit int) ([]*storage.Download, error) {
	return a.videoHandler.GetDownloadHistory(limit)
}

func (a *App) ClearDownloadHistory() error {
	return a.videoHandler.ClearDownloadHistory()
}

func (a *App) CancelDownload(id string) error {
	return a.videoHandler.CancelDownload(id)
}

func (a *App) OpenUrl(url string) {
	application.Get().Browser.OpenURL(url)
}

// SetClipboardMonitor enables or disables the clipboard monitoring
func (a *App) SetClipboardMonitor(enabled bool) {
	if a.clipboardMonitor == nil {
		return
	}
	// Update State
	if enabled {
		a.clipboardMonitor.Start(a.ctx)
	} else {
		a.clipboardMonitor.Stop()
	}
	// Persist Config
	a.cfg.ClipboardMonitorEnabled = enabled
	if err := a.cfg.Save(); err != nil {
		logger.Log.Error().Err(err).Msg("failed to save config in SetClipboardMonitor")
	}
}

func (a *App) OpenDownloadFolder(id string) error {
	return a.videoHandler.OpenDownloadFolder(id, a.downloadRepo, a.paths.Downloads, a.systemHandler.OpenPath)
}

func (a *App) GetInstagramCarousel(url string) (*handlers.MediaInfo, error) {
	return a.mediaHandler.GetInstagramCarousel(url)
}

func (a *App) GetImageInfo(url string) (*images.ImageInfo, error) {
	return a.mediaHandler.GetImageInfo(url)
}

func (a *App) DownloadImage(url string, filename string) (string, error) {
	imagesDir := a.paths.Images
	if a.cfg.ImageDownloadPath != "" {
		imagesDir = a.cfg.ImageDownloadPath
	}
	imgCfg := a.cfg.GetImageConfig()
	return a.mediaHandler.DownloadImage(url, filename, imagesDir, a.paths.FFmpegPath(), imgCfg.Format, imgCfg.Quality)
}

func (a *App) GetSettings() config.Config {
	return a.settingsHandler.GetSettings()
}

func (a *App) SaveSettings(newCfg *config.Config) error {
	return a.settingsHandler.SaveSettings(newCfg)
}

func (a *App) SelectDirectory() (string, error) {
	return a.settingsHandler.SelectDirectory()
}

func (a *App) SelectVideoDirectory() (string, error) {
	return a.settingsHandler.SelectVideoDirectory()
}

func (a *App) SelectImageDirectory() (string, error) {
	return a.settingsHandler.SelectImageDirectory()
}

func (a *App) GetDownloadsPath() string {
	return a.settingsHandler.GetDownloadsPath(a.paths.Downloads)
}

func (a *App) GetVideoDownloadPath() string {
	return a.settingsHandler.GetVideoDownloadPath(a.paths.Downloads)
}

func (a *App) GetImageDownloadPath() string {
	return a.settingsHandler.GetImageDownloadPath(a.paths.Images)
}

func (a *App) CheckDependencies() []launcher.DependencyStatus {
	if a.systemHandler == nil {
		return nil
	}
	return a.systemHandler.CheckDependencies()
}

func (a *App) NeedsDependencies() bool {
	if a.systemHandler == nil {
		return true
	}
	return a.systemHandler.NeedsDependencies()
}

func (a *App) DownloadDependencies() error {
	return a.systemHandler.DownloadDependencies()
}

func (a *App) CheckAria2cStatus() handlers.Aria2cStatus {
	return a.systemHandler.CheckAria2cStatus()
}

func (a *App) DownloadAria2c() error {
	return a.systemHandler.DownloadAria2c()
}

func (a *App) DeleteAria2c() error {
	return a.systemHandler.DeleteAria2c()
}

func (a *App) CheckForUpdate() (*updater.UpdateInfo, error) {
	return a.systemHandler.CheckForUpdate()
}

func (a *App) GetAvailableAppVersions() ([]updater.Release, error) {
	return a.systemHandler.GetAvailableAppVersions()
}

func (a *App) InstallAppVersion(tag string) error {
	return a.systemHandler.InstallAppVersion(tag)
}

func (a *App) DownloadAndApplyUpdate(downloadURL string) error {
	return a.systemHandler.DownloadAndApplyUpdate(downloadURL)
}

func (a *App) RestartApp() {
	a.systemHandler.RestartApp()
}

func (a *App) SelectVideoFile() (string, error) {
	return a.converterHandler.SelectVideoFile()
}

func (a *App) SelectImageFile() (string, error) {
	return a.converterHandler.SelectImageFile()
}

func (a *App) SelectOutputDirectory() (string, error) {
	return a.converterHandler.SelectOutputDirectory()
}

func (a *App) ConvertVideo(req handlers.VideoConvertRequest) (*handlers.ConversionResult, error) {
	return a.converterHandler.ConvertVideo(req)
}

func (a *App) CompressVideo(inputPath string, quality string, preset string) (*handlers.ConversionResult, error) {
	return a.converterHandler.CompressVideo(inputPath, quality, preset)
}

func (a *App) ExtractAudio(req handlers.AudioExtractRequest) (*handlers.ConversionResult, error) {
	return a.converterHandler.ExtractAudio(req)
}

func (a *App) ConvertImage(req handlers.ImageConvertRequest) (*handlers.ConversionResult, error) {
	return a.converterHandler.ConvertImage(req)
}

func (a *App) CompressImage(inputPath string, quality int) (*handlers.ConversionResult, error) {
	return a.converterHandler.CompressImage(inputPath, quality)
}

func (a *App) GetVersion() string {
	return Version
}

// --- Transcriber ---

func (a *App) SelectMediaFile() (string, error) {
	return a.transcriberHandler.SelectMediaFile()
}

func (a *App) TranscribeFile(req handlers.TranscribeRequest) (*whisper.TranscribeResult, error) {
	return a.transcriberHandler.TranscribeFile(req)
}

func (a *App) ListWhisperModels() ([]whisper.ModelInfo, error) {
	return a.transcriberHandler.ListWhisperModels()
}

func (a *App) GetAvailableWhisperModels() []whisper.AvailableModel {
	return a.transcriberHandler.GetAvailableWhisperModels()
}

func (a *App) DownloadWhisperModel(name string) error {
	return a.transcriberHandler.DownloadWhisperModel(name)
}

func (a *App) DeleteWhisperModel(name string) error {
	return a.transcriberHandler.DeleteWhisperModel(name)
}

func (a *App) IsWhisperInstalled() bool {
	return a.transcriberHandler.IsWhisperInstalled()
}

func (a *App) DownloadWhisperBinary() error {
	return a.transcriberHandler.DownloadWhisperBinary()
}

// GetRoadmap fetches roadmap items from the configured source
func (a *App) GetRoadmap(lang string) ([]roadmap.RoadmapItem, error) {
	return a.roadmap.FetchRoadmap(lang)
}

// ServiceShutdown is called when the app shuts down (Wails v3 lifecycle)
func (a *App) ServiceShutdown() error {
	// Stop download manager gracefully
	if a.downloadManager != nil {
		a.downloadManager.Stop()
	}

	// Stop clipboard monitor
	if a.clipboardMonitor != nil {
		a.clipboardMonitor.Stop()
	}

	// Stop proxy server
	if a.proxyServer != nil {
		a.proxyServer.Close()
	}

	// Close database connection
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			logger.Log.Error().Err(err).Msg("failed to close database")
		}
	}

	logger.Log.Info().Msg("application shutdown complete")
	return nil
}

// --- Auth & Interactivity ---

// StartGitHubAuth initiates Device Flow and returns user code + verification URL
func (a *App) StartGitHubAuth() (*auth.DeviceCodeResponse, error) {
	return a.auth.StartDeviceFlow()
}

// PollGitHubAuth polls until user authorizes (or timeout)
func (a *App) PollGitHubAuth(deviceCode string) (string, error) {
	return a.auth.PollToken(deviceCode, 5) // 5s interval
}

func (a *App) GetGitHubToken() string {
	return a.auth.Token
}

func (a *App) LogoutGitHub() {
	a.auth.Logout()
}

func (a *App) VoteFeature(issueID int) error {
	if a.auth.Token == "" {
		return fmt.Errorf("authentication required")
	}
	err := a.roadmap.VoteOnIssue(a.auth.Token, issueID)
	if err != nil && isUnauthorized(err) {
		if newToken, refreshErr := a.auth.RefreshAccessToken(); refreshErr == nil {
			return a.roadmap.VoteOnIssue(newToken, issueID)
		}
		a.auth.Logout()
		return fmt.Errorf("session expired, please login again")
	}
	return err
}

func (a *App) VoteDownFeature(issueID int) error {
	if a.auth.Token == "" {
		return fmt.Errorf("authentication required")
	}
	err := a.roadmap.VoteDownOnIssue(a.auth.Token, issueID)
	if err != nil && isUnauthorized(err) {
		if newToken, refreshErr := a.auth.RefreshAccessToken(); refreshErr == nil {
			return a.roadmap.VoteDownOnIssue(newToken, issueID)
		}
		a.auth.Logout()
		return fmt.Errorf("session expired, please login again")
	}
	return err
}

// GetUserReaction returns the user's current reaction on a specific issue
// Returns "+1" for thumbs up, "-1" for thumbs down, or "" for no reaction
func (a *App) GetUserReaction(issueID int) (string, error) {
	if a.auth.Token == "" {
		return "", nil // Not authenticated, no reactions
	}
	reaction, err := a.roadmap.GetUserReaction(a.auth.Token, issueID)
	if err != nil && isUnauthorized(err) {
		if newToken, refreshErr := a.auth.RefreshAccessToken(); refreshErr == nil {
			return a.roadmap.GetUserReaction(newToken, issueID)
		}
		a.auth.Logout()
		return "", fmt.Errorf("session expired, please login again")
	}
	return reaction, err
}

// GetUserReactions returns a map of issue IDs to user's reaction for syncing with frontend
// This fetches reactions for all roadmap items at once
func (a *App) GetUserReactions() (map[int]string, error) {
	if a.auth.Token == "" {
		return map[int]string{}, nil // Not authenticated, no reactions
	}

	// Get all roadmap items from cache without triggering a fetch
	items := a.roadmap.GetCachedItems()
	if len(items) == 0 {
		// Fallback: fetch if cache is empty
		var err error
		items, err = a.roadmap.FetchRoadmap("pt-BR")
		if err != nil {
			return nil, err
		}
	}

	// Fetch reactions concurrently with bounded parallelism
	type result struct {
		id       int
		reaction string
	}

	results := make(chan result, len(items))
	sem := make(chan struct{}, 5) // Max 5 concurrent API calls

	var wg sync.WaitGroup
	for _, item := range items {
		wg.Add(1)
		go func(issueID int) {
			defer wg.Done()
			sem <- struct{}{}        // Acquire
			defer func() { <-sem }() // Release

			reaction, err := a.roadmap.GetUserReaction(a.auth.Token, issueID)
			if err != nil || reaction == "" {
				return
			}
			results <- result{id: issueID, reaction: reaction}
		}(item.ID)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	reactions := make(map[int]string)
	for r := range results {
		reactions[r.id] = r.reaction
	}

	return reactions, nil
}

func (a *App) SuggestFeature(title, desc string) error {
	if a.auth.Token == "" {
		return fmt.Errorf("authentication required")
	}
	err := a.roadmap.CreateIssue(a.auth.Token, title, desc)
	if err != nil && isUnauthorized(err) {
		if newToken, refreshErr := a.auth.RefreshAccessToken(); refreshErr == nil {
			return a.roadmap.CreateIssue(newToken, title, desc)
		}
		a.auth.Logout()
		return fmt.Errorf("session expired, please login again")
	}
	return err
}

// isUnauthorized checks if an error indicates an expired/invalid token (HTTP 401)
func isUnauthorized(err error) bool {
	return err != nil && strings.Contains(err.Error(), "status 401")
}

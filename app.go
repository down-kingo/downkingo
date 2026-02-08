package main

import (
	"context"
	"fmt"
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
	"kingo/internal/youtube"
	"os"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Version is set at build time via ldflags
var Version = "2.0.3"

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

	videoHandler     *handlers.VideoHandler
	mediaHandler     *handlers.MediaHandler
	settingsHandler  *handlers.SettingsHandler
	systemHandler    *handlers.SystemHandler
	converterHandler *handlers.ConverterHandler
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		clipboardMonitor: clipboard.NewMonitor(),
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
	a.videoHandler = handlers.NewVideoHandler(a.youtube, a.downloadManager)
	a.videoHandler.SetContext(ctx)
	a.videoHandler.SetConsoleEmitter(a.consoleLog)

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
}

// consoleLog emits a user-friendly message to the frontend console.
func (a *App) consoleLog(message string) {
	application.Get().Event.Emit(events.ConsoleLog, message)
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

	// Get all roadmap items from cache (use default language)
	items, err := a.roadmap.FetchRoadmap("pt-BR")
	if err != nil {
		return nil, err
	}

	reactions := make(map[int]string)
	for _, item := range items {
		reaction, err := a.roadmap.GetUserReaction(a.auth.Token, item.ID)
		if err != nil {
			// Log but continue - don't fail the whole batch for one item
			continue
		}
		if reaction != "" {
			reactions[item.ID] = reaction
		}
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

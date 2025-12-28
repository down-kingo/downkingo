package main

import (
	"context"
	"kinematic/internal/app"
	"kinematic/internal/events"
	"kinematic/internal/launcher"
	"kinematic/internal/logger"
	"kinematic/internal/updater"
	"kinematic/internal/youtube"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Version is set at build time via ldflags
var Version = "0.1.0"

// App struct holds all application services
type App struct {
	ctx      context.Context
	paths    *app.Paths
	launcher *launcher.Launcher
	youtube  *youtube.Client
	updater  *updater.Updater
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize paths
	paths, err := app.GetPaths()
	if err != nil {
		logger.Log.Error().Err(err).Msg("failed to get paths")
		return
	}
	a.paths = paths

	// Inicializar logger (precisa do paths.AppData para saber onde gravar)
	if err := logger.Init(paths.AppData); err != nil {
		// Fallback: se não conseguir criar o logger, continuar sem ele
		// (o logger já tem um valor zero que descarta logs)
		println("Warning: failed to initialize logger:", err.Error())
	}

	logger.Log.Info().
		Str("version", Version).
		Str("binDir", paths.Bin).
		Str("downloadsDir", paths.Downloads).
		Msg("kinematic starting up")

	// Ensure all directories exist
	if err := paths.EnsureDirectories(); err != nil {
		logger.Log.Error().Err(err).Msg("failed to create directories")
		return
	}

	// Initialize launcher
	a.launcher = launcher.NewLauncher(paths.Bin)
	a.launcher.SetContext(ctx)

	// Initialize YouTube client
	a.youtube = youtube.NewClient(paths.YtDlpPath(), paths.FFmpegPath(), paths.Downloads)
	a.youtube.SetContext(ctx)

	// Initialize updater
	a.updater = updater.NewUpdater(Version)
	a.updater.SetContext(ctx)

	// Emitir evento app:ready para o frontend
	needsSetup := a.launcher.NeedsDependencies()
	runtime.EventsEmit(ctx, events.AppReady, map[string]bool{
		"needsSetup": needsSetup,
	})

	logger.Log.Info().Bool("needsSetup", needsSetup).Msg("startup complete")
}

// === Launcher Methods (exposed to Frontend) ===

// CheckDependencies returns the status of all dependencies
func (a *App) CheckDependencies() []launcher.DependencyStatus {
	return a.launcher.CheckDependencies()
}

// NeedsDependencies returns true if any dependency is missing
func (a *App) NeedsDependencies() bool {
	return a.launcher.NeedsDependencies()
}

// DownloadDependencies downloads all missing dependencies
func (a *App) DownloadDependencies() error {
	return a.launcher.DownloadDependencies()
}

// === YouTube Methods (exposed to Frontend) ===

// GetVideoInfo fetches metadata for a URL
func (a *App) GetVideoInfo(url string) (*youtube.VideoInfo, error) {
	return a.youtube.GetVideoInfo(url)
}

// Download downloads a video
func (a *App) Download(opts youtube.DownloadOptions) error {
	return a.youtube.Download(opts)
}

// === Updater Methods (exposed to Frontend) ===

// CheckForUpdate checks GitHub for a newer release
func (a *App) CheckForUpdate() (*updater.UpdateInfo, error) {
	return a.updater.CheckForUpdate()
}

// DownloadAndApplyUpdate downloads and installs an update
func (a *App) DownloadAndApplyUpdate(downloadURL string) error {
	return a.updater.DownloadAndApply(downloadURL)
}

// RestartApp restarts the application
func (a *App) RestartApp() {
	a.updater.RestartApp()
}

// === Utility Methods ===

// GetVersion returns the current app version
func (a *App) GetVersion() string {
	return Version
}

// GetDownloadsPath returns the downloads directory
func (a *App) GetDownloadsPath() string {
	if a.paths != nil {
		return a.paths.Downloads
	}
	return ""
}

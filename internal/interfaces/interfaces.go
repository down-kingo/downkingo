// Package interfaces defines contracts for all handlers.
// Following Go's interface segregation principle, interfaces are defined
// where they are consumed, not where they are implemented.
// This enables easy mocking for tests and proper dependency injection.
package interfaces

import (
	"context"

	"kingo/internal/config"
	"kingo/internal/images"
	"kingo/internal/launcher"
	"kingo/internal/storage"
	"kingo/internal/updater"
	"kingo/internal/youtube"
)

// VideoService defines the contract for video operations.
// Used by the App facade to interact with video functionality.
type VideoService interface {
	GetVideoInfo(url string) (*youtube.VideoInfo, error)
	UpdateYtDlp(channel string) (string, error)
	Download(opts youtube.DownloadOptions) error
	AddToQueue(url string, format string, audioOnly bool) (*storage.Download, error)
	AddToQueueAdvanced(opts youtube.DownloadOptions) (*storage.Download, error)
	GetDownloadQueue() ([]*storage.Download, error)
	GetDownloadHistory(limit int) ([]*storage.Download, error)
	ClearDownloadHistory() error
	CancelDownload(id string) error
}

// MediaService defines the contract for media operations (images, Instagram, etc).
type MediaService interface {
	GetInstagramCarousel(url string) (interface{}, error)
	GetImageInfo(url string) (*images.ImageInfo, error)
	DownloadImage(url, filename, imagesDir, ffmpegPath, format string, quality int) (string, error)
}

// SettingsService defines the contract for application settings.
type SettingsService interface {
	GetSettings() config.Config
	SaveSettings(newCfg *config.Config) error
	SelectDirectory() (string, error)
	SelectVideoDirectory() (string, error)
	SelectImageDirectory() (string, error)
	GetDownloadsPath(defaultPath string) string
	GetVideoDownloadPath(defaultPath string) string
	GetImageDownloadPath(defaultPath string) string
}

// SystemService defines the contract for system operations.
type SystemService interface {
	CheckDependencies() []launcher.DependencyStatus
	NeedsDependencies() bool
	DownloadDependencies() error
	CheckForUpdate() (*updater.UpdateInfo, error)
	GetAvailableAppVersions() ([]updater.Release, error)
	InstallAppVersion(tag string) error
	DownloadAndApplyUpdate(downloadURL string) error
	RestartApp()
	OpenPath(path string, selectFile bool) error
}

// ConverterService defines the contract for media conversion operations.
type ConverterService interface {
	SelectVideoFile() (string, error)
	SelectImageFile() (string, error)
	SelectOutputDirectory() (string, error)
	ConvertVideo(req interface{}) (interface{}, error)
	CompressVideo(inputPath string, quality string, preset string) (interface{}, error)
	ExtractAudio(req interface{}) (interface{}, error)
	ConvertImage(req interface{}) (interface{}, error)
	CompressImage(inputPath string, quality int) (interface{}, error)
}

// DownloadManager defines the contract for download queue management.
type DownloadManager interface {
	Start()
	Stop()
	AddJob(opts youtube.DownloadOptions) (*storage.Download, error)
	CancelJob(id string) error
	GetQueue() ([]*storage.Download, error)
	GetHistory(limit int) ([]*storage.Download, error)
	ClearHistory() error
}

// YouTubeClient defines the contract for yt-dlp operations.
type YouTubeClient interface {
	SetContext(ctx context.Context)
	SetOutputDirectory(dir string)
	SetAria2Path(path string)
	GetVideoInfo(ctx context.Context, url string) (*youtube.VideoInfo, error)
	GetVideoInfoWithCookies(ctx context.Context, url string, browser string) (*youtube.VideoInfo, error)
	GetPlaylistInfo(ctx context.Context, url string) ([]youtube.VideoInfo, error)
	Download(ctx context.Context, opts youtube.DownloadOptions, onProgress youtube.ProgressCallback, onLog youtube.LogCallback) error
	UpdateYtDlp(channel string) (string, error)
	HasAria2() bool
}

// ClipboardMonitor defines the contract for clipboard watching.
type ClipboardMonitor interface {
	Start(ctx context.Context)
	Stop()
}

// ConsoleEmitter is a function type for emitting console logs to the frontend.
type ConsoleEmitter func(message string)

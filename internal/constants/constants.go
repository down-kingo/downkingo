// Package constants defines application-wide constants and magic strings.
// Centralizing these values improves maintainability and reduces typos.
package constants

import "time"

// Application metadata
const (
	AppName    = "DownKingo"
	AppID      = "com.downkingo.app"
	AppVersion = "2.0.0-beta"
	ConfigFile = "settings.json"
	DBFile     = "downkingo.db"
)

// Timeouts
const (
	// HTTPTimeout is the default timeout for HTTP requests.
	HTTPTimeout = 30 * time.Second

	// DownloadTimeout is the maximum time for a single download.
	DownloadTimeout = 2 * time.Hour

	// MetadataTimeout is the timeout for fetching video metadata.
	MetadataTimeout = 30 * time.Second

	// ClipboardPollInterval is how often to check the clipboard.
	ClipboardPollInterval = 2 * time.Second
)

// Queue settings
const (
	// MaxConcurrentDownloads is the default max concurrent downloads.
	MaxConcurrentDownloads = 3

	// MaxQueueSize is the maximum number of items in the download queue.
	MaxQueueSize = 100

	// MaxHistoryItems is the default max items to return in history.
	MaxHistoryItems = 100

	// MaxHistoryItemsAbsolute is the absolute maximum for history queries.
	MaxHistoryItemsAbsolute = 500
)

// File size limits
const (
	// MaxFilenameLength is the maximum length for generated filenames.
	MaxFilenameLength = 200

	// MaxTitleLength is the maximum length for video titles in logs.
	MaxTitleLength = 100
)

// Default values for download options
const (
	DefaultVideoFormat      = "best"
	DefaultAudioFormat      = "mp3"
	DefaultAudioBitrate     = "192"
	DefaultImageFormat      = "original"
	DefaultImageQuality     = 100
	DefaultAria2Connections = 16
	MaxAria2Connections     = 32
)

// Supported formats
var (
	SupportedAudioFormats = []string{"mp3", "m4a", "opus", "flac", "wav", "aac"}
	SupportedVideoFormats = []string{"mp4", "mkv", "webm", "avi", "mov"}
	SupportedImageFormats = []string{"original", "png", "jpg", "jpeg", "webp", "avif"}
)

// Update channels for yt-dlp
var AllowedUpdateChannels = []string{"stable", "nightly", "master"}

// Event names for Wails events
const (
	EventAppReady           = "app:ready"
	EventDownloadAdded      = "download:added"
	EventDownloadProgress   = "download:progress"
	EventDownloadLog        = "download:log"
	EventConsoleLog         = "console:log"
	EventClipboardDetected  = "clipboard:link-detected"
	EventDeepLink           = "deep-link"
	EventDependencyProgress = "dependency:progress"
)

// Database status values
const (
	StatusPending     = "pending"
	StatusDownloading = "downloading"
	StatusMerging     = "merging"
	StatusCompleted   = "completed"
	StatusFailed      = "failed"
	StatusCancelled   = "cancelled"
)

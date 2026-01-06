package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type ImageConfig struct {
	Format  string `json:"format"`  // original, png, jpg, webp, avif
	Quality int    `json:"quality"` // 0-100 (high is better)
}

type ShortcutsConfig struct {
	FocusInput    string `json:"focusInput"`    // Default: Ctrl+L
	OpenSettings  string `json:"openSettings"`  // Default: Ctrl+,
	OpenQueue     string `json:"openQueue"`     // Default: Ctrl+Q
	OpenHistory   string `json:"openHistory"`   // Default: Ctrl+H
	OpenDownloads string `json:"openDownloads"` // Default: Ctrl+D
}

// RoadmapConfig holds CDN configuration for the roadmap feature
type RoadmapConfig struct {
	CDNEnabled bool   `json:"cdnEnabled"` // Use CDN instead of direct GitHub API
	CDNBaseURL string `json:"cdnBaseUrl"` // Base URL for CDN (e.g., "https://downkingo-roadmap.pages.dev")
}

type Config struct {
	DownloadsPath           string          `json:"downloadsPath"` // Deprecated: use Video/Image specific paths
	VideoDownloadPath       string          `json:"videoDownloadPath"`
	ImageDownloadPath       string          `json:"imageDownloadPath"`
	Image                   ImageConfig     `json:"image"`
	Shortcuts               ShortcutsConfig `json:"shortcuts"`
	ClipboardMonitorEnabled bool            `json:"clipboardMonitorEnabled"`
	Roadmap                 RoadmapConfig   `json:"roadmap"`

	mu       sync.RWMutex
	filePath string
}

func Default() *Config {
	return &Config{
		DownloadsPath:     "", // Empty means use default logic
		VideoDownloadPath: "",
		ImageDownloadPath: "",
		Image: ImageConfig{
			Format:  "original",
			Quality: 100,
		},
		ClipboardMonitorEnabled: true,
		Shortcuts: ShortcutsConfig{
			FocusInput:    "Ctrl+L",
			OpenSettings:  "Ctrl+,",
			OpenQueue:     "Ctrl+Q",
			OpenHistory:   "Ctrl+H",
			OpenDownloads: "Ctrl+D",
		},
		Roadmap: RoadmapConfig{
			CDNEnabled: true, // CDN enabled by default for optimal performance
			CDNBaseURL: "https://downkingo-roadmap.pages.dev",
		},
	}
}

// Load reads the config file from the given directory (e.g. AppData)
func Load(configDir string) (*Config, error) {
	filePath := filepath.Join(configDir, "settings.json")
	cfg := Default()
	cfg.filePath = filePath

	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist, return default.
			// Caller might want to Save() it immediately to create the file.
			return cfg, nil
		}
		return nil, err
	}

	if err := json.Unmarshal(data, cfg); err != nil {
		// If corrupted, return default but keep filepath
		cfg = Default()
		cfg.filePath = filePath
		return cfg, nil
	}

	cfg.filePath = filePath // Restore filepath after unmarshal overwrite

	// Migration: If legacy DownloadsPath is set but new specific paths are empty, use legacy
	if cfg.DownloadsPath != "" {
		if cfg.VideoDownloadPath == "" {
			cfg.VideoDownloadPath = cfg.DownloadsPath
		}
		if cfg.ImageDownloadPath == "" {
			cfg.ImageDownloadPath = cfg.DownloadsPath
		}
	}

	// Environment variable overrides (useful for dev/CI/staging)
	// DOWNKINGO_ROADMAP_CDN=1 or DOWNKINGO_ROADMAP_CDN=true
	if envCDN := os.Getenv("DOWNKINGO_ROADMAP_CDN"); envCDN != "" {
		cfg.Roadmap.CDNEnabled = envCDN == "1" || envCDN == "true"
	}
	// DOWNKINGO_ROADMAP_CDN_URL=https://preview-abc123.pages.dev
	if envURL := os.Getenv("DOWNKINGO_ROADMAP_CDN_URL"); envURL != "" {
		cfg.Roadmap.CDNBaseURL = envURL
	}

	return cfg, nil
}

// Save writes the current config to disk
func (c *Config) Save() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(c.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(c.filePath, data, 0644)
}

// Thread-safe Setters/Getters

// Update executes a function to modify the config with the mutex held
func (c *Config) Update(fn func(*Config)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	fn(c)
}

func (c *Config) UpdateImageSettings(format string, quality int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Image.Format = format
	c.Image.Quality = quality
}

func (c *Config) UpdateShortcuts(s ShortcutsConfig) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Shortcuts = s
}

func (c *Config) Get() Config {
	c.mu.RLock()
	defer c.mu.RUnlock()
	// Return a complete copy of all fields
	return Config{
		DownloadsPath:           c.DownloadsPath,
		VideoDownloadPath:       c.VideoDownloadPath,
		ImageDownloadPath:       c.ImageDownloadPath,
		Image:                   c.Image,
		Shortcuts:               c.Shortcuts,
		ClipboardMonitorEnabled: c.ClipboardMonitorEnabled,
		Roadmap:                 c.Roadmap,
	}
}

func (c *Config) GetImageConfig() ImageConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Image
}

func (c *Config) GetRoadmapConfig() RoadmapConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Roadmap
}

package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestDefault(t *testing.T) {
	cfg := Default()

	if cfg.Image.Format != "original" {
		t.Errorf("Image.Format = %q, want %q", cfg.Image.Format, "original")
	}
	if cfg.Image.Quality != 100 {
		t.Errorf("Image.Quality = %d, want %d", cfg.Image.Quality, 100)
	}
	if !cfg.ClipboardMonitorEnabled {
		t.Error("ClipboardMonitorEnabled should default to true")
	}
	if !cfg.Roadmap.CDNEnabled {
		t.Error("Roadmap.CDNEnabled should default to true")
	}
	if cfg.Roadmap.CDNBaseURL == "" {
		t.Error("Roadmap.CDNBaseURL should not be empty")
	}
	if cfg.Shortcuts.FocusInput != "Ctrl+L" {
		t.Errorf("Shortcuts.FocusInput = %q, want %q", cfg.Shortcuts.FocusInput, "Ctrl+L")
	}
}

func TestLoad_NonExistentFile(t *testing.T) {
	dir := t.TempDir()

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load() should not error for missing file: %v", err)
	}

	// Should return defaults
	if cfg.Image.Format != "original" {
		t.Errorf("should return defaults, got Image.Format = %q", cfg.Image.Format)
	}
}

func TestLoad_ValidConfig(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "settings.json")

	data := `{
		"videoDownloadPath": "C:\\Videos",
		"imageDownloadPath": "C:\\Images",
		"image": {"format": "webp", "quality": 80},
		"clipboardMonitorEnabled": false,
		"roadmap": {
			"cdnEnabled": true,
			"cdnBaseUrl": "https://cdn.example.com"
		}
	}`

	os.WriteFile(filePath, []byte(data), 0644)

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.VideoDownloadPath != "C:\\Videos" {
		t.Errorf("VideoDownloadPath = %q, want %q", cfg.VideoDownloadPath, "C:\\Videos")
	}
	if cfg.Image.Format != "webp" {
		t.Errorf("Image.Format = %q, want %q", cfg.Image.Format, "webp")
	}
	if cfg.Image.Quality != 80 {
		t.Errorf("Image.Quality = %d, want %d", cfg.Image.Quality, 80)
	}
	if cfg.ClipboardMonitorEnabled {
		t.Error("ClipboardMonitorEnabled should be false")
	}
}

func TestLoad_CorruptedFile(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "settings.json")

	os.WriteFile(filePath, []byte("not valid json {{{"), 0644)

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load() should not error for corrupted file: %v", err)
	}

	// Should return defaults
	if cfg.Image.Format != "original" {
		t.Errorf("corrupted file should return defaults, got Image.Format = %q", cfg.Image.Format)
	}
}

func TestLoad_LegacyPathMigration(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "settings.json")

	// Legacy config only has downloadsPath
	data := `{
		"downloadsPath": "C:\\Downloads",
		"roadmap": {
			"cdnEnabled": true,
			"cdnBaseUrl": "https://cdn.example.com"
		}
	}`
	os.WriteFile(filePath, []byte(data), 0644)

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	// Should migrate to separate paths
	if cfg.VideoDownloadPath != "C:\\Downloads" {
		t.Errorf("VideoDownloadPath = %q, want %q (migrated)", cfg.VideoDownloadPath, "C:\\Downloads")
	}
	if cfg.ImageDownloadPath != "C:\\Downloads" {
		t.Errorf("ImageDownloadPath = %q, want %q (migrated)", cfg.ImageDownloadPath, "C:\\Downloads")
	}
}

func TestLoad_LegacyRoadmapMigration(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "settings.json")

	// Legacy config without roadmap section
	data := `{"clipboardMonitorEnabled": true}`
	os.WriteFile(filePath, []byte(data), 0644)

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	// Should apply default roadmap config
	if !cfg.Roadmap.CDNEnabled {
		t.Error("CDNEnabled should default to true for legacy configs")
	}
	if cfg.Roadmap.CDNBaseURL == "" {
		t.Error("CDNBaseURL should be set for legacy configs")
	}
}

func TestLoad_EnvOverrides(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "settings.json")

	data := `{
		"roadmap": {
			"cdnEnabled": false,
			"cdnBaseUrl": "https://original.com"
		}
	}`
	os.WriteFile(filePath, []byte(data), 0644)

	// Set env overrides
	t.Setenv("DOWNKINGO_ROADMAP_CDN", "true")
	t.Setenv("DOWNKINGO_ROADMAP_CDN_URL", "https://preview.pages.dev")

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if !cfg.Roadmap.CDNEnabled {
		t.Error("CDNEnabled should be overridden to true by env")
	}
	if cfg.Roadmap.CDNBaseURL != "https://preview.pages.dev" {
		t.Errorf("CDNBaseURL = %q, want %q", cfg.Roadmap.CDNBaseURL, "https://preview.pages.dev")
	}
}

func TestSave(t *testing.T) {
	dir := t.TempDir()
	cfg := Default()
	cfg.filePath = filepath.Join(dir, "settings.json")
	cfg.VideoDownloadPath = "C:\\MyVideos"

	err := cfg.Save()
	if err != nil {
		t.Fatalf("Save() error: %v", err)
	}

	// Read file and verify
	data, err := os.ReadFile(cfg.filePath)
	if err != nil {
		t.Fatalf("failed to read saved file: %v", err)
	}

	var saved Config
	json.Unmarshal(data, &saved)
	if saved.VideoDownloadPath != "C:\\MyVideos" {
		t.Errorf("saved VideoDownloadPath = %q, want %q", saved.VideoDownloadPath, "C:\\MyVideos")
	}
}

func TestConfig_ThreadSafety(t *testing.T) {
	cfg := Default()
	cfg.filePath = filepath.Join(t.TempDir(), "settings.json")

	done := make(chan struct{})

	// Concurrent reads and writes
	go func() {
		for i := 0; i < 100; i++ {
			cfg.Get()
		}
		close(done)
	}()

	for i := 0; i < 100; i++ {
		cfg.Update(func(c *Config) {
			c.VideoDownloadPath = "path"
		})
	}

	<-done
}

func TestConfig_GetImageConfig(t *testing.T) {
	cfg := Default()
	cfg.Image.Format = "avif"
	cfg.Image.Quality = 90

	img := cfg.GetImageConfig()
	if img.Format != "avif" {
		t.Errorf("Format = %q, want %q", img.Format, "avif")
	}
	if img.Quality != 90 {
		t.Errorf("Quality = %d, want %d", img.Quality, 90)
	}
}

func TestConfig_UpdateImageSettings(t *testing.T) {
	cfg := Default()
	cfg.UpdateImageSettings("png", 75)

	if cfg.Image.Format != "png" {
		t.Errorf("Format = %q, want %q", cfg.Image.Format, "png")
	}
	if cfg.Image.Quality != 75 {
		t.Errorf("Quality = %d, want %d", cfg.Image.Quality, 75)
	}
}

func TestConfig_UpdateShortcuts(t *testing.T) {
	cfg := Default()
	newShortcuts := ShortcutsConfig{
		FocusInput:   "Ctrl+K",
		OpenSettings: "Ctrl+P",
	}
	cfg.UpdateShortcuts(newShortcuts)

	if cfg.Shortcuts.FocusInput != "Ctrl+K" {
		t.Errorf("FocusInput = %q, want %q", cfg.Shortcuts.FocusInput, "Ctrl+K")
	}
}

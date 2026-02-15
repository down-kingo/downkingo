package handlers

import (
	"context"
	"kingo/internal/config"
	"kingo/internal/logger"
	"kingo/internal/youtube"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// SettingsHandler encapsulates all settings-related operations.
type SettingsHandler struct {
	ctx     context.Context
	cfg     *config.Config
	youtube *youtube.Client
}

// NewSettingsHandler creates a new SettingsHandler with dependencies.
func NewSettingsHandler(cfg *config.Config, yt *youtube.Client) *SettingsHandler {
	return &SettingsHandler{
		ctx:     context.Background(),
		cfg:     cfg,
		youtube: yt,
	}
}

// SetContext sets the Wails runtime context.
func (h *SettingsHandler) SetContext(ctx context.Context) {
	h.ctx = ctx
}

// SetConfig updates the configuration reference.
func (h *SettingsHandler) SetConfig(cfg *config.Config) {
	h.cfg = cfg
}

// GetSettings returns the current application configuration.
func (h *SettingsHandler) GetSettings() config.Config {
	return h.cfg.Get()
}

// SaveSettings updates and persists the configuration.
func (h *SettingsHandler) SaveSettings(newCfg *config.Config) error {
	// Use thread-safe update method
	h.cfg.Update(func(c *config.Config) {
		// Apply Video Path change
		if newCfg.VideoDownloadPath != "" {
			c.VideoDownloadPath = newCfg.VideoDownloadPath
		}

		// Apply Image Path change
		if newCfg.ImageDownloadPath != "" {
			c.ImageDownloadPath = newCfg.ImageDownloadPath
		}

		// Legacy support
		if newCfg.DownloadsPath != "" {
			c.DownloadsPath = newCfg.DownloadsPath
		}

		// Apply Image Settings
		c.Image.Format = newCfg.Image.Format
		c.Image.Quality = newCfg.Image.Quality

		// Persist Clipboard Monitor setting
		c.ClipboardMonitorEnabled = newCfg.ClipboardMonitorEnabled
		c.AnonymousMode = newCfg.AnonymousMode
	})

	// Update youtube client output directory if needed
	if newCfg.VideoDownloadPath != "" && h.youtube != nil {
		h.youtube.SetOutputDirectory(newCfg.VideoDownloadPath)
	}

	return h.cfg.Save()
}

// SelectVideoDirectory opens a dialog for selecting video directory.
func (h *SettingsHandler) SelectVideoDirectory() (string, error) {
	selection, err := application.Get().Dialog.OpenFile().
		SetTitle("Selecione a pasta para Vídeos").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		PromptForSingleSelection()
	if err != nil {
		return "", err
	}

	if selection != "" {
		h.cfg.VideoDownloadPath = selection
		if h.youtube != nil {
			h.youtube.SetOutputDirectory(selection)
		}
		if err := h.cfg.Save(); err != nil {
			logger.Log.Error().Err(err).Msg("failed to save config after video directory selection")
		}
	}
	return selection, nil
}

// SelectImageDirectory opens a dialog for selecting image directory.
func (h *SettingsHandler) SelectImageDirectory() (string, error) {
	selection, err := application.Get().Dialog.OpenFile().
		SetTitle("Selecione a pasta para Imagens").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		PromptForSingleSelection()
	if err != nil {
		return "", err
	}

	if selection != "" {
		h.cfg.ImageDownloadPath = selection
		if err := h.cfg.Save(); err != nil {
			logger.Log.Error().Err(err).Msg("failed to save config after image directory selection")
		}
	}
	return selection, nil
}

// SelectDirectory is legacy function, redirects to SelectVideoDirectory.
func (h *SettingsHandler) SelectDirectory() (string, error) {
	return h.SelectVideoDirectory()
}

// GetVideoDownloadPath returns the video downloads directory.
func (h *SettingsHandler) GetVideoDownloadPath(defaultPath string) string {
	if h.cfg.VideoDownloadPath != "" {
		return h.cfg.VideoDownloadPath
	}
	return defaultPath
}

// GetImageDownloadPath returns the image downloads directory.
func (h *SettingsHandler) GetImageDownloadPath(defaultPath string) string {
	if h.cfg.ImageDownloadPath != "" {
		return h.cfg.ImageDownloadPath
	}
	return defaultPath
}

// GetDownloadsPath returns the legacy downloads directory.
func (h *SettingsHandler) GetDownloadsPath(defaultPath string) string {
	return defaultPath
}

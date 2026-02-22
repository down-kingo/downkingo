package handlers

import (
	"context"
	"fmt"
	"strings"

	apperr "kingo/internal/errors"
	"kingo/internal/storage"
	"kingo/internal/validate"
	"kingo/internal/youtube"
)

// YouTubeClientInterface defines what VideoHandler needs from a YouTube client.
// This interface is consumed here following Go's interface segregation principle.
type YouTubeClientInterface interface {
	GetVideoInfo(ctx context.Context, url string) (*youtube.VideoInfo, error)
	Download(ctx context.Context, opts youtube.DownloadOptions, onProgress youtube.ProgressCallback, onLog youtube.LogCallback) error
	UpdateYtDlp(channel string) (string, error)
	GetStreamURL(ctx context.Context, url string, format string) (string, error)
}

// DownloadManagerInterface defines what VideoHandler needs from a download manager.
type DownloadManagerInterface interface {
	AddJob(opts youtube.DownloadOptions) (*storage.Download, error)
	CancelJob(id string) error
	GetQueue() ([]*storage.Download, error)
	GetHistory(limit int) ([]*storage.Download, error)
	ClearHistory() error
}

// VideoHandler encapsulates all video-related operations.
// Follows the Single Responsibility Principle - only handles video/download logic.
// Uses interface-based dependency injection for testability.
type VideoHandler struct {
	ctx             context.Context
	youtube         YouTubeClientInterface
	downloadManager DownloadManagerInterface
	consoleEmitter  func(string)
}

// NewVideoHandler creates a new VideoHandler with dependencies.
// Uses constructor injection for testability - accepts interfaces, not concrete types.
func NewVideoHandler(yt YouTubeClientInterface, dm DownloadManagerInterface) *VideoHandler {
	return &VideoHandler{
		ctx:             context.Background(),
		youtube:         yt,
		downloadManager: dm,
		consoleEmitter:  func(s string) {}, // no-op default
	}
}

// SetContext sets the Wails runtime context.
func (h *VideoHandler) SetContext(ctx context.Context) {
	h.ctx = ctx
}

// SetConsoleEmitter sets the function to emit user-friendly console logs.
func (h *VideoHandler) SetConsoleEmitter(emitter func(string)) {
	h.consoleEmitter = emitter
}

// consoleLog emits a message to the user console.
func (h *VideoHandler) consoleLog(message string) {
	if h.consoleEmitter != nil {
		h.consoleEmitter(message)
	}
}

// GetVideoInfo fetches metadata for a video URL.
// Validates URL before making external calls.
func (h *VideoHandler) GetVideoInfo(url string) (*youtube.VideoInfo, error) {
	const op = "VideoHandler.GetVideoInfo"

	// Validate URL
	if _, err := validate.URL(url); err != nil {
		h.consoleLog("[Vídeo] ✗ URL inválida")
		return nil, apperr.Wrap(op, err)
	}

	// Check if youtube client is available
	if h.youtube == nil {
		return nil, apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "cliente YouTube não inicializado")
	}

	h.consoleLog("[Vídeo] Buscando informações...")

	info, err := h.youtube.GetVideoInfo(h.ctx, url)
	if err != nil {
		h.consoleLog("[Vídeo] ✗ Falha ao buscar informações")

		// Wrap with user-friendly message based on error type
		if strings.Contains(err.Error(), "unsupported") {
			return nil, apperr.WrapWithMessage(op, apperr.ErrUnsupportedPlatform, "Plataforma não suportada pelo yt-dlp")
		}
		if strings.Contains(err.Error(), "private") || strings.Contains(err.Error(), "login") {
			return nil, apperr.WrapWithMessage(op, apperr.ErrAuthRequired, "Vídeo privado ou requer autenticação")
		}

		return nil, apperr.Wrap(op, err)
	}

	h.consoleLog(fmt.Sprintf("[Vídeo] ✓ \"%s\" encontrado", info.Title))
	return info, nil
}

// UpdateYtDlp updates the yt-dlp binary.
func (h *VideoHandler) UpdateYtDlp(channel string) (string, error) {
	const op = "VideoHandler.UpdateYtDlp"

	if h.youtube == nil {
		return "", apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "cliente yt-dlp não inicializado")
	}

	// Validate channel - only allow known safe channels
	channel = validate.NonEmptyString(channel, "stable")
	allowedChannels := []string{"stable", "nightly", "master"}
	validChannel := false
	for _, c := range allowedChannels {
		if channel == c {
			validChannel = true
			break
		}
	}
	if !validChannel {
		channel = "stable"
	}

	h.consoleLog("[Atualização] Verificando nova versão do yt-dlp...")

	version, err := h.youtube.UpdateYtDlp(channel)
	if err != nil {
		h.consoleLog("[Atualização] ✗ Falha ao atualizar")
		return "", apperr.Wrap(op, err)
	}

	h.consoleLog(fmt.Sprintf("[Atualização] yt-dlp atualizado para %s", version))
	return version, nil
}

// Download executes a direct download (legacy method).
// Consider using AddToQueue for better UX with progress tracking.
func (h *VideoHandler) Download(opts youtube.DownloadOptions) error {
	const op = "VideoHandler.Download"

	// Validate URL
	if _, err := validate.URL(opts.URL); err != nil {
		return apperr.Wrap(op, err)
	}

	if h.youtube == nil {
		return apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "cliente YouTube não inicializado")
	}

	return h.youtube.Download(h.ctx, opts, nil, nil)
}

// AddToQueue adds a download to the queue with validation.
func (h *VideoHandler) AddToQueue(url string, format string, audioOnly bool) (*storage.Download, error) {
	const op = "VideoHandler.AddToQueue"

	// Validate URL
	if _, err := validate.URL(url); err != nil {
		return nil, apperr.Wrap(op, err)
	}

	// Check if download manager is available
	if h.downloadManager == nil {
		return nil, apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "gerenciador de downloads não inicializado")
	}

	// Sanitize format
	format = strings.TrimSpace(format)
	if format == "" {
		format = "best"
	}

	if audioOnly {
		h.consoleLog("[Áudio] Adicionando à fila de downloads...")
	} else {
		h.consoleLog("[Vídeo] Adicionando à fila de downloads...")
	}

	opts := youtube.DownloadOptions{
		URL:       url,
		Format:    format,
		AudioOnly: audioOnly,
	}

	download, err := h.downloadManager.AddJob(opts)
	if err != nil {
		return nil, apperr.Wrap(op, err)
	}

	return download, nil
}

// AddToQueueAdvanced adds a download with all options.
// Validates the options before adding to queue.
func (h *VideoHandler) AddToQueueAdvanced(opts youtube.DownloadOptions) (*storage.Download, error) {
	const op = "VideoHandler.AddToQueueAdvanced"

	// Validate URL
	if _, err := validate.URL(opts.URL); err != nil {
		return nil, apperr.Wrap(op, err)
	}

	// Check if download manager is available
	if h.downloadManager == nil {
		return nil, apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "gerenciador de downloads não inicializado")
	}

	// Sanitize audio format
	if opts.AudioOnly && opts.AudioFormat == "" {
		opts.AudioFormat = "mp3"
	}

	// Validate aria2c connections (prevent abuse)
	if opts.Aria2cConnections < 0 || opts.Aria2cConnections > 32 {
		opts.Aria2cConnections = 16
	}

	download, err := h.downloadManager.AddJob(opts)
	if err != nil {
		return nil, apperr.Wrap(op, err)
	}

	return download, nil
}

// GetDownloadQueue returns all pending and active downloads.
func (h *VideoHandler) GetDownloadQueue() ([]*storage.Download, error) {
	const op = "VideoHandler.GetDownloadQueue"

	if h.downloadManager == nil {
		return nil, apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "gerenciador de downloads não inicializado")
	}

	queue, err := h.downloadManager.GetQueue()
	if err != nil {
		return nil, apperr.Wrap(op, err)
	}

	return queue, nil
}

// GetDownloadHistory returns completed downloads.
func (h *VideoHandler) GetDownloadHistory(limit int) ([]*storage.Download, error) {
	const op = "VideoHandler.GetDownloadHistory"

	if h.downloadManager == nil {
		return nil, apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "gerenciador de downloads não inicializado")
	}

	// Validate and sanitize limit
	limit = validate.PositiveInt(limit, 50)
	if limit > 500 {
		limit = 500 // Cap at reasonable maximum
	}

	history, err := h.downloadManager.GetHistory(limit)
	if err != nil {
		return nil, apperr.Wrap(op, err)
	}

	return history, nil
}

// ClearDownloadHistory removes all completed/failed/cancelled downloads.
func (h *VideoHandler) ClearDownloadHistory() error {
	const op = "VideoHandler.ClearDownloadHistory"

	if h.downloadManager == nil {
		return apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "gerenciador de downloads não inicializado")
	}

	if err := h.downloadManager.ClearHistory(); err != nil {
		return apperr.Wrap(op, err)
	}

	h.consoleLog("[Sistema] Histórico de downloads limpo")
	return nil
}

// CancelDownload cancels a specific download.
func (h *VideoHandler) CancelDownload(id string) error {
	const op = "VideoHandler.CancelDownload"

	// Validate ID
	id = strings.TrimSpace(id)
	if id == "" {
		return apperr.NewWithMessage(op, apperr.ErrInvalidURL, "ID do download não pode estar vazio")
	}

	if h.downloadManager == nil {
		return apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "gerenciador de downloads não inicializado")
	}

	if err := h.downloadManager.CancelJob(id); err != nil {
		return apperr.Wrap(op, err)
	}

	return nil
}

// GetStreamURL extracts the direct stream URL for video preview (trimmer).
func (h *VideoHandler) GetStreamURL(url string, format string) (string, error) {
	const op = "VideoHandler.GetStreamURL"

	if _, err := validate.URL(url); err != nil {
		return "", apperr.Wrap(op, err)
	}

	if h.youtube == nil {
		return "", apperr.NewWithMessage(op, apperr.ErrDependencyMissing, "cliente YouTube não inicializado")
	}

	h.consoleLog("[Trimmer] Extraindo URL do stream...")

	streamURL, err := h.youtube.GetStreamURL(h.ctx, url, format)
	if err != nil {
		h.consoleLog("[Trimmer] ✗ Falha ao extrair URL do stream")
		return "", apperr.Wrap(op, err)
	}

	h.consoleLog("[Trimmer] ✓ Stream URL extraído com sucesso")
	return streamURL, nil
}

// OpenDownloadFolder opens the folder containing the download file.
func (h *VideoHandler) OpenDownloadFolder(id string, downloadRepo *storage.DownloadRepository, defaultPath string, openPathFn func(string, bool) error) error {
	const op = "VideoHandler.OpenDownloadFolder"

	if id == "" {
		return openPathFn(defaultPath, false)
	}

	download, err := downloadRepo.GetByID(id)
	if err != nil {
		return apperr.Wrap(op, err)
	}

	if download == nil || download.FilePath == "" {
		return openPathFn(defaultPath, false)
	}

	return openPathFn(download.FilePath, true)
}

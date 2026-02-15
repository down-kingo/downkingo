package handlers

import (
	"context"
	"fmt"
	"path/filepath"

	"kingo/internal/app"
	"kingo/internal/whisper"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// TranscriberHandler handles transcription operations.
type TranscriberHandler struct {
	ctx            context.Context
	paths          *app.Paths
	whisper        *whisper.Client
	consoleEmitter func(string)
}

// TranscribeRequest represents a transcription request from frontend.
type TranscribeRequest struct {
	FilePath     string `json:"filePath"`
	Model        string `json:"model"`
	Language     string `json:"language"`
	OutputFormat string `json:"outputFormat"`
}

// NewTranscriberHandler creates a new TranscriberHandler.
func NewTranscriberHandler(paths *app.Paths, whisperClient *whisper.Client) *TranscriberHandler {
	return &TranscriberHandler{
		ctx:            context.Background(),
		paths:          paths,
		whisper:        whisperClient,
		consoleEmitter: func(s string) {},
	}
}

// SetContext injects the Wails runtime context.
func (h *TranscriberHandler) SetContext(ctx context.Context) {
	h.ctx = ctx
	h.whisper.SetContext(ctx)
}

// SetConsoleEmitter sets the function to emit user-friendly console logs.
func (h *TranscriberHandler) SetConsoleEmitter(emitter func(string)) {
	h.consoleEmitter = emitter
}

func (h *TranscriberHandler) consoleLog(message string) {
	if h.consoleEmitter != nil {
		h.consoleEmitter(message)
	}
}

// SelectMediaFile opens a file dialog to select an audio or video file.
func (h *TranscriberHandler) SelectMediaFile() (string, error) {
	file, err := application.Get().Dialog.OpenFile().
		SetTitle("Select Audio/Video File").
		AddFilter("Media Files", "*.mp3;*.wav;*.m4a;*.ogg;*.flac;*.mp4;*.mkv;*.avi;*.mov;*.webm").
		AddFilter("Audio", "*.mp3;*.wav;*.m4a;*.ogg;*.flac;*.aac;*.wma").
		AddFilter("Video", "*.mp4;*.mkv;*.avi;*.mov;*.webm;*.wmv;*.flv").
		AddFilter("All Files", "*.*").
		PromptForSingleSelection()

	if err != nil {
		return "", err
	}
	return file, nil
}

// TranscribeFile transcribes an audio/video file.
func (h *TranscriberHandler) TranscribeFile(req TranscribeRequest) (*whisper.TranscribeResult, error) {
	if req.FilePath == "" {
		return nil, fmt.Errorf("file path is required")
	}
	if req.Model == "" {
		return nil, fmt.Errorf("model is required")
	}

	inputName := filepath.Base(req.FilePath)
	h.consoleLog(fmt.Sprintf("[Transcriber] Transcribing: %s (model: %s)", inputName, req.Model))

	result, err := h.whisper.TranscribeFile(req.FilePath, req.Model, req.Language, req.OutputFormat)
	if err != nil {
		h.consoleLog(fmt.Sprintf("[Transcriber] Error: %s", err.Error()))
		return nil, err
	}

	h.consoleLog(fmt.Sprintf("[Transcriber] Transcription complete: %s", inputName))
	return result, nil
}

// ListWhisperModels lists downloaded whisper models.
func (h *TranscriberHandler) ListWhisperModels() ([]whisper.ModelInfo, error) {
	return h.whisper.ListModels()
}

// GetAvailableWhisperModels returns models available for download.
func (h *TranscriberHandler) GetAvailableWhisperModels() []whisper.AvailableModel {
	return h.whisper.GetAvailableModels()
}

// DownloadWhisperModel downloads a whisper model.
func (h *TranscriberHandler) DownloadWhisperModel(name string) error {
	h.consoleLog(fmt.Sprintf("[Transcriber] Downloading model: %s", name))
	err := h.whisper.DownloadModel(name)
	if err != nil {
		h.consoleLog(fmt.Sprintf("[Transcriber] Download error: %s", err.Error()))
		return err
	}
	h.consoleLog(fmt.Sprintf("[Transcriber] Model downloaded: %s", name))
	return nil
}

// DeleteWhisperModel deletes a whisper model.
func (h *TranscriberHandler) DeleteWhisperModel(name string) error {
	h.consoleLog(fmt.Sprintf("[Transcriber] Deleting model: %s", name))
	return h.whisper.DeleteModel(name)
}

// IsWhisperInstalled checks if the whisper binary is available.
func (h *TranscriberHandler) IsWhisperInstalled() bool {
	return h.whisper.IsBinaryInstalled()
}

// DownloadWhisperBinary downloads and installs the whisper.cpp binary.
func (h *TranscriberHandler) DownloadWhisperBinary() error {
	h.consoleLog("[Transcriber] Downloading whisper binary...")
	err := h.whisper.DownloadBinary()
	if err != nil {
		h.consoleLog(fmt.Sprintf("[Transcriber] Binary download error: %s", err.Error()))
		return err
	}
	h.consoleLog("[Transcriber] Whisper binary installed successfully")
	return nil
}

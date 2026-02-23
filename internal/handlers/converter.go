package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"

	_ "golang.org/x/image/webp"

	"kingo/internal/app"
	"kingo/internal/converter"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/image/draw"
)

// ConverterHandler handles all media conversion operations.
type ConverterHandler struct {
	ctx            context.Context
	paths          *app.Paths
	consoleEmitter func(string)
}

// NewConverterHandler creates a new ConverterHandler.
func NewConverterHandler(paths *app.Paths) *ConverterHandler {
	return &ConverterHandler{
		ctx:            context.Background(),
		paths:          paths,
		consoleEmitter: func(s string) {},
	}
}

// SetContext injects the Wails runtime context.
func (h *ConverterHandler) SetContext(ctx context.Context) {
	h.ctx = ctx
}

// SetConsoleEmitter sets the function to emit user-friendly console logs.
func (h *ConverterHandler) SetConsoleEmitter(emitter func(string)) {
	h.consoleEmitter = emitter
}

func (h *ConverterHandler) consoleLog(message string) {
	if h.consoleEmitter != nil {
		h.consoleEmitter(message)
	}
}

// =============================================================================
// FILE SELECTION
// =============================================================================

// SelectVideoFile opens a file dialog to select a video file.
func (h *ConverterHandler) SelectVideoFile() (string, error) {
	file, err := application.Get().Dialog.OpenFile().
		SetTitle("Selecionar Vídeo").
		AddFilter("Vídeos", "*.mp4;*.mkv;*.avi;*.mov;*.webm;*.wmv;*.flv").
		AddFilter("Todos os Arquivos", "*.*").
		PromptForSingleSelection()

	if err != nil {
		return "", err
	}
	return file, nil
}

// SelectImageFile opens a file dialog to select an image file.
func (h *ConverterHandler) SelectImageFile() (string, error) {
	file, err := application.Get().Dialog.OpenFile().
		SetTitle("Selecionar Imagem").
		AddFilter("Imagens", "*.jpg;*.jpeg;*.png;*.webp;*.avif;*.bmp;*.tiff;*.gif").
		AddFilter("Todos os Arquivos", "*.*").
		PromptForSingleSelection()

	if err != nil {
		return "", err
	}
	return file, nil
}

// SelectOutputDirectory opens a dialog to select output directory.
func (h *ConverterHandler) SelectOutputDirectory() (string, error) {
	dir, err := application.Get().Dialog.OpenFile().
		SetTitle("Selecionar Pasta de Saída").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		PromptForSingleSelection()
	if err != nil {
		return "", err
	}
	return dir, nil
}

// =============================================================================
// FILE UTILITIES
// =============================================================================

// GetFileSize returns the size in bytes of the file at the given path.
func (h *ConverterHandler) GetFileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

// ReadImageThumbnail reads an image file, resizes it to maxSize pixels,
// and returns a data:image/jpeg;base64,... string for use as a thumbnail.
func (h *ConverterHandler) ReadImageThumbnail(inputPath string, maxSize int) (string, error) {
	f, err := os.Open(inputPath)
	if err != nil {
		return "", fmt.Errorf("failed to open image: %w", err)
	}
	defer f.Close()

	src, _, err := image.Decode(f)
	if err != nil {
		return "", fmt.Errorf("failed to decode image: %w", err)
	}

	// Calculate new dimensions maintaining aspect ratio
	bounds := src.Bounds()
	imgW, imgH := bounds.Dx(), bounds.Dy()
	if maxSize <= 0 {
		maxSize = 96
	}

	var newW, newH int
	if imgW >= imgH {
		newW = maxSize
		newH = int(float64(imgH) * float64(maxSize) / float64(imgW))
	} else {
		newH = maxSize
		newW = int(float64(imgW) * float64(maxSize) / float64(imgH))
	}
	if newW < 1 {
		newW = 1
	}
	if newH < 1 {
		newH = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 80}); err != nil {
		return "", fmt.Errorf("failed to encode thumbnail: %w", err)
	}

	b64 := base64.StdEncoding.EncodeToString(buf.Bytes())
	return "data:image/jpeg;base64," + b64, nil
}

// =============================================================================
// MULTI-FILE SELECTION (BATCH)
// =============================================================================

// SelectVideoFiles opens a dialog to select multiple video files.
func (h *ConverterHandler) SelectVideoFiles() ([]string, error) {
	files, err := application.Get().Dialog.OpenFile().
		SetTitle("Selecionar Vídeos").
		AddFilter("Vídeos", "*.mp4;*.mkv;*.avi;*.mov;*.webm;*.wmv;*.flv").
		AddFilter("Todos os Arquivos", "*.*").
		PromptForMultipleSelection()

	if err != nil {
		return nil, err
	}
	return files, nil
}

// SelectImageFiles opens a dialog to select multiple image files.
func (h *ConverterHandler) SelectImageFiles() ([]string, error) {
	files, err := application.Get().Dialog.OpenFile().
		SetTitle("Selecionar Imagens").
		AddFilter("Imagens", "*.jpg;*.jpeg;*.png;*.webp;*.avif;*.bmp;*.tiff;*.gif").
		AddFilter("Todos os Arquivos", "*.*").
		PromptForMultipleSelection()

	if err != nil {
		return nil, err
	}
	return files, nil
}

// =============================================================================
// VIDEO CONVERSION
// =============================================================================

// VideoConvertRequest represents a video conversion request from frontend.
type VideoConvertRequest struct {
	InputPath  string `json:"inputPath"`
	OutputDir  string `json:"outputDir"`
	Format     string `json:"format"`     // mp4, mkv, webm, avi, mov
	Quality    string `json:"quality"`    // lossless, high, medium, low, tiny
	CustomCRF  int    `json:"customCrf"`  // 0-51, overrides quality
	Preset     string `json:"preset"`     // ultrafast, fast, medium, slow, veryslow
	Resolution string `json:"resolution"` // e.g. "1920x1080"
	KeepAudio  bool   `json:"keepAudio"`
	CustomName string `json:"customName"` // Custom output filename (without extension)
}

// ConversionResult represents the result of any conversion.
type ConversionResult struct {
	OutputPath   string  `json:"outputPath"`
	InputSize    int64   `json:"inputSize"`
	OutputSize   int64   `json:"outputSize"`
	Compression  float64 `json:"compression"` // Percentage saved
	Success      bool    `json:"success"`
	ErrorMessage string  `json:"errorMessage,omitempty"`
}

// ConvertVideo converts a video to another format.
func (h *ConverterHandler) ConvertVideo(req VideoConvertRequest) (*ConversionResult, error) {
	ffmpegPath := h.paths.FFmpegPath()
	inputName := filepath.Base(req.InputPath)

	h.consoleLog(fmt.Sprintf("[Converter] Convertendo vídeo: %s → %s", inputName, req.Format))

	// Map string format to type
	var format converter.VideoFormat
	switch req.Format {
	case "mp4":
		format = converter.VideoFormatMP4
	case "mkv":
		format = converter.VideoFormatMKV
	case "webm":
		format = converter.VideoFormatWebM
	case "avi":
		format = converter.VideoFormatAVI
	case "mov":
		format = converter.VideoFormatMOV
	default:
		return nil, fmt.Errorf("formato não suportado: %s", req.Format)
	}

	// Map string quality to type
	var quality converter.VideoQuality
	switch req.Quality {
	case "lossless":
		quality = converter.VideoQualityLossless
	case "high":
		quality = converter.VideoQualityHigh
	case "medium":
		quality = converter.VideoQualityMedium
	case "low":
		quality = converter.VideoQualityLow
	case "tiny":
		quality = converter.VideoQualityTiny
	default:
		quality = converter.VideoQualityMedium
	}

	result, err := converter.ConvertVideo(converter.VideoConvertOptions{
		InputPath:  req.InputPath,
		OutputDir:  req.OutputDir,
		Format:     format,
		Quality:    quality,
		CustomCRF:  req.CustomCRF,
		Preset:     req.Preset,
		Resolution: req.Resolution,
		KeepAudio:  req.KeepAudio,
		FFmpegPath: ffmpegPath,
		CustomName: req.CustomName,
	})

	if err != nil {
		h.consoleLog(fmt.Sprintf("[Converter] Erro: %s", err.Error()))
		return &ConversionResult{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	compression := 0.0
	if result.InputSize > 0 {
		compression = (1.0 - float64(result.OutputSize)/float64(result.InputSize)) * 100
	}

	h.consoleLog(fmt.Sprintf("[Converter] ✓ Conversão concluída! Redução de %.1f%%", compression))

	return &ConversionResult{
		OutputPath:  result.OutputPath,
		InputSize:   result.InputSize,
		OutputSize:  result.OutputSize,
		Compression: compression,
		Success:     true,
	}, nil
}

// CompressVideo compresses a video keeping the same format.
func (h *ConverterHandler) CompressVideo(inputPath string, quality string, preset string) (*ConversionResult, error) {
	ffmpegPath := h.paths.FFmpegPath()

	var q converter.VideoQuality
	switch quality {
	case "high":
		q = converter.VideoQualityHigh
	case "medium":
		q = converter.VideoQualityMedium
	case "low":
		q = converter.VideoQualityLow
	case "tiny":
		q = converter.VideoQualityTiny
	default:
		q = converter.VideoQualityMedium
	}

	inputName := filepath.Base(inputPath)
	h.consoleLog(fmt.Sprintf("[Converter] Comprimindo vídeo: %s (qualidade: %s)", inputName, quality))

	result, err := converter.CompressVideo(inputPath, q, preset, ffmpegPath)
	if err != nil {
		return &ConversionResult{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	compression := 0.0
	if result.InputSize > 0 {
		compression = (1.0 - float64(result.OutputSize)/float64(result.InputSize)) * 100
	}

	h.consoleLog(fmt.Sprintf("[Converter] ✓ Compressão concluída! Redução de %.1f%%", compression))

	return &ConversionResult{
		OutputPath:  result.OutputPath,
		InputSize:   result.InputSize,
		OutputSize:  result.OutputSize,
		Compression: compression,
		Success:     true,
	}, nil
}

// =============================================================================
// AUDIO EXTRACTION
// =============================================================================

// AudioExtractRequest represents an audio extraction request.
type AudioExtractRequest struct {
	InputPath     string `json:"inputPath"`
	OutputDir     string `json:"outputDir"`
	Format        string `json:"format"`        // mp3, aac, m4a, flac, wav, ogg, opus
	Quality       string `json:"quality"`       // low, medium, high, best
	CustomBitrate int    `json:"customBitrate"` // kbps, overrides quality
	CustomName    string `json:"customName"`    // Custom output filename (without extension)
}

// ExtractAudio extracts audio from a video file.
func (h *ConverterHandler) ExtractAudio(req AudioExtractRequest) (*ConversionResult, error) {
	ffmpegPath := h.paths.FFmpegPath()
	inputName := filepath.Base(req.InputPath)

	h.consoleLog(fmt.Sprintf("[Converter] Extraindo áudio: %s → %s", inputName, req.Format))

	var format converter.AudioFormat
	switch req.Format {
	case "mp3":
		format = converter.AudioFormatMP3
	case "aac":
		format = converter.AudioFormatAAC
	case "m4a":
		format = converter.AudioFormatM4A
	case "flac":
		format = converter.AudioFormatFLAC
	case "wav":
		format = converter.AudioFormatWAV
	case "ogg":
		format = converter.AudioFormatOGG
	case "opus":
		format = converter.AudioFormatOPUS
	default:
		return nil, fmt.Errorf("formato de áudio não suportado: %s", req.Format)
	}

	var quality converter.AudioQuality
	switch req.Quality {
	case "low":
		quality = converter.AudioQualityLow
	case "medium":
		quality = converter.AudioQualityMedium
	case "high":
		quality = converter.AudioQualityHigh
	case "best":
		quality = converter.AudioQualityBest
	default:
		quality = converter.AudioQualityMedium
	}

	result, err := converter.ExtractAudio(converter.AudioExtractOptions{
		InputPath:     req.InputPath,
		OutputDir:     req.OutputDir,
		Format:        format,
		Quality:       quality,
		CustomBitrate: req.CustomBitrate,
		FFmpegPath:    ffmpegPath,
		CustomName:    req.CustomName,
	})

	if err != nil {
		h.consoleLog(fmt.Sprintf("[Converter] Erro: %s", err.Error()))
		return &ConversionResult{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	// Fix: calcular a economia de tamanho (vídeo → áudio é sempre drástico)
	compression := 0.0
	if result.InputSize > 0 {
		compression = (1.0 - float64(result.OutputSize)/float64(result.InputSize)) * 100
	}

	h.consoleLog(fmt.Sprintf("[Converter] ✓ Áudio extraído: %s (redução de %.1f%%)", filepath.Base(result.OutputPath), compression))

	return &ConversionResult{
		OutputPath:  result.OutputPath,
		InputSize:   result.InputSize,
		OutputSize:  result.OutputSize,
		Compression: compression,
		Success:     true,
	}, nil
}

// =============================================================================
// IMAGE CONVERSION
// =============================================================================

// ImageConvertRequest represents an image conversion request.
type ImageConvertRequest struct {
	InputPath  string `json:"inputPath"`
	OutputDir  string `json:"outputDir"`
	Format     string `json:"format"`     // jpg, png, webp, avif, bmp, tiff
	Quality    int    `json:"quality"`    // 0-100
	Width      int    `json:"width"`      // 0 = keep original
	Height     int    `json:"height"`     // 0 = keep original
	CustomName string `json:"customName"` // Custom output filename (without extension)
}

// ConvertImage converts an image to another format.
func (h *ConverterHandler) ConvertImage(req ImageConvertRequest) (*ConversionResult, error) {
	ffmpegPath := h.paths.FFmpegPath()
	inputName := filepath.Base(req.InputPath)

	h.consoleLog(fmt.Sprintf("[Converter] Convertendo imagem: %s → %s", inputName, req.Format))

	var format converter.ImageFormat
	switch req.Format {
	case "jpg", "jpeg":
		format = converter.ImageFormatJPEG
	case "png":
		format = converter.ImageFormatPNG
	case "webp":
		format = converter.ImageFormatWebP
	case "avif":
		format = converter.ImageFormatAVIF
	case "bmp":
		format = converter.ImageFormatBMP
	case "tiff":
		format = converter.ImageFormatTIFF
	default:
		return nil, fmt.Errorf("formato de imagem não suportado: %s", req.Format)
	}

	result, err := converter.ConvertImage(converter.ImageConvertOptions{
		InputPath:   req.InputPath,
		OutputDir:   req.OutputDir,
		Format:      format,
		Quality:     req.Quality,
		Width:       req.Width,
		Height:      req.Height,
		FFmpegPath:  ffmpegPath,
		AvifencPath: h.paths.AvifencPath(),
		CustomName:  req.CustomName,
	})

	if err != nil {
		return &ConversionResult{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	compression := 0.0
	if result.InputSize > 0 {
		compression = (1.0 - float64(result.OutputSize)/float64(result.InputSize)) * 100
	}

	h.consoleLog(fmt.Sprintf("[Converter] ✓ Imagem convertida! Redução de %.1f%%", compression))

	return &ConversionResult{
		OutputPath:  result.OutputPath,
		InputSize:   result.InputSize,
		OutputSize:  result.OutputSize,
		Compression: compression,
		Success:     true,
	}, nil
}

// CompressImage compresses an image keeping the same format.
func (h *ConverterHandler) CompressImage(inputPath string, quality int) (*ConversionResult, error) {
	ffmpegPath := h.paths.FFmpegPath()
	inputName := filepath.Base(inputPath)

	h.consoleLog(fmt.Sprintf("[Converter] Comprimindo imagem: %s (qualidade: %d%%)", inputName, quality))

	result, err := converter.CompressImage(inputPath, quality, ffmpegPath, h.paths.AvifencPath())
	if err != nil {
		return &ConversionResult{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	compression := 0.0
	if result.InputSize > 0 {
		compression = (1.0 - float64(result.OutputSize)/float64(result.InputSize)) * 100
	}

	return &ConversionResult{
		OutputPath:  result.OutputPath,
		InputSize:   result.InputSize,
		OutputSize:  result.OutputSize,
		Compression: compression,
		Success:     true,
	}, nil
}

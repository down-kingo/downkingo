// Package converter provides video, audio and image conversion using FFmpeg.
package converter

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// VideoFormat represents supported output video formats
type VideoFormat string

const (
	VideoFormatMP4  VideoFormat = "mp4"
	VideoFormatMKV  VideoFormat = "mkv"
	VideoFormatWebM VideoFormat = "webm"
	VideoFormatAVI  VideoFormat = "avi"
	VideoFormatMOV  VideoFormat = "mov"
)

// VideoQuality represents compression presets (CRF values)
type VideoQuality string

const (
	VideoQualityLossless VideoQuality = "lossless" // CRF 0
	VideoQualityHigh     VideoQuality = "high"     // CRF 18
	VideoQualityMedium   VideoQuality = "medium"   // CRF 23
	VideoQualityLow      VideoQuality = "low"      // CRF 28
	VideoQualityTiny     VideoQuality = "tiny"     // CRF 35
)

// VideoConvertOptions configures video conversion
type VideoConvertOptions struct {
	InputPath  string
	OutputDir  string       // If empty, uses same directory as input
	Format     VideoFormat  // Target format
	Quality    VideoQuality // Compression quality
	CustomCRF  int          // Custom CRF value (0-51), overrides Quality if > 0
	Preset     string       // FFmpeg preset: ultrafast, fast, medium, slow, veryslow
	Resolution string       // Target resolution e.g. "1920x1080", empty = keep original
	KeepAudio  bool         // Whether to copy audio stream
	FFmpegPath string       // Path to FFmpeg binary
}

// VideoConvertResult contains the result of a video conversion
type VideoConvertResult struct {
	OutputPath string
	InputSize  int64
	OutputSize int64
}

// ConvertVideo converts a video file to another format using FFmpeg.
// Returns the path to the converted file.
func ConvertVideo(opts VideoConvertOptions) (*VideoConvertResult, error) {
	if opts.FFmpegPath == "" {
		return nil, fmt.Errorf("ffmpeg path is required")
	}

	if _, err := os.Stat(opts.InputPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("input file does not exist: %s", opts.InputPath)
	}

	// Get input file info
	inputInfo, err := os.Stat(opts.InputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat input file: %w", err)
	}

	// Build output path
	inputExt := filepath.Ext(opts.InputPath)
	baseName := strings.TrimSuffix(filepath.Base(opts.InputPath), inputExt)
	outputDir := opts.OutputDir
	if outputDir == "" {
		outputDir = filepath.Dir(opts.InputPath)
	}
	outputPath := filepath.Join(outputDir, baseName+"_converted."+string(opts.Format))

	// Build FFmpeg arguments
	args := []string{"-i", opts.InputPath, "-y"} // -y to overwrite

	// Video codec based on format
	switch opts.Format {
	case VideoFormatMP4, VideoFormatMOV:
		args = append(args, "-c:v", "libx264")
		args = append(args, "-movflags", "+faststart") // Web optimization
	case VideoFormatMKV:
		args = append(args, "-c:v", "libx264")
	case VideoFormatWebM:
		args = append(args, "-c:v", "libvpx-vp9")
		args = append(args, "-b:v", "0") // Required for CRF mode in VP9
	case VideoFormatAVI:
		args = append(args, "-c:v", "mpeg4")
	default:
		return nil, fmt.Errorf("unsupported output format: %s", opts.Format)
	}

	// Quality/CRF
	crf := getCRFValue(opts.Quality)
	if opts.CustomCRF > 0 {
		crf = opts.CustomCRF
	}

	if opts.Format == VideoFormatAVI {
		// AVI uses -q:v instead of -crf (1-31 scale, lower is better)
		qv := 31 - (crf * 31 / 51)
		if qv < 1 {
			qv = 1
		}
		args = append(args, "-q:v", fmt.Sprintf("%d", qv))
	} else {
		args = append(args, "-crf", fmt.Sprintf("%d", crf))
	}

	// Preset (encoding speed)
	preset := opts.Preset
	if preset == "" {
		preset = "medium"
	}
	if opts.Format != VideoFormatAVI { // AVI doesn't support presets
		args = append(args, "-preset", preset)
	}

	// Resolution
	if opts.Resolution != "" {
		args = append(args, "-vf", fmt.Sprintf("scale=%s", opts.Resolution))
	}

	// Audio handling
	if opts.KeepAudio {
		switch opts.Format {
		case VideoFormatWebM:
			args = append(args, "-c:a", "libopus")
		case VideoFormatAVI:
			args = append(args, "-c:a", "libmp3lame", "-b:a", "192k")
		default:
			args = append(args, "-c:a", "aac", "-b:a", "192k")
		}
	} else {
		args = append(args, "-an") // No audio
	}

	args = append(args, outputPath)

	// Execute FFmpeg
	cmd := exec.Command(opts.FFmpegPath, args...)
	setSysProcAttr(cmd)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("ffmpeg error: %v | output: %s", err, string(output))
	}

	// Get output file size
	outputInfo, err := os.Stat(outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat output file: %w", err)
	}

	return &VideoConvertResult{
		OutputPath: outputPath,
		InputSize:  inputInfo.Size(),
		OutputSize: outputInfo.Size(),
	}, nil
}

// CompressVideo compresses a video file using CRF encoding.
// This is essentially ConvertVideo but keeps the same format.
func CompressVideo(inputPath string, quality VideoQuality, preset string, ffmpegPath string) (*VideoConvertResult, error) {
	// Detect input format
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(inputPath), "."))
	format := VideoFormatMP4 // Default
	switch ext {
	case "mkv":
		format = VideoFormatMKV
	case "webm":
		format = VideoFormatWebM
	case "avi":
		format = VideoFormatAVI
	case "mov":
		format = VideoFormatMOV
	}

	return ConvertVideo(VideoConvertOptions{
		InputPath:  inputPath,
		Format:     format,
		Quality:    quality,
		Preset:     preset,
		KeepAudio:  true,
		FFmpegPath: ffmpegPath,
	})
}

// getCRFValue converts quality preset to CRF value
func getCRFValue(quality VideoQuality) int {
	switch quality {
	case VideoQualityLossless:
		return 0
	case VideoQualityHigh:
		return 18
	case VideoQualityMedium:
		return 23
	case VideoQualityLow:
		return 28
	case VideoQualityTiny:
		return 35
	default:
		return 23 // Medium as default
	}
}

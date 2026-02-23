package converter

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// AudioFormat represents supported output audio formats
type AudioFormat string

const (
	AudioFormatMP3  AudioFormat = "mp3"
	AudioFormatAAC  AudioFormat = "aac"
	AudioFormatM4A  AudioFormat = "m4a"
	AudioFormatFLAC AudioFormat = "flac"
	AudioFormatWAV  AudioFormat = "wav"
	AudioFormatOGG  AudioFormat = "ogg"
	AudioFormatOPUS AudioFormat = "opus"
)

// AudioQuality represents audio bitrate presets
type AudioQuality string

const (
	AudioQualityLow    AudioQuality = "low"    // 128kbps
	AudioQualityMedium AudioQuality = "medium" // 192kbps
	AudioQualityHigh   AudioQuality = "high"   // 256kbps
	AudioQualityBest   AudioQuality = "best"   // 320kbps
)

// AudioExtractOptions configures audio extraction from video
type AudioExtractOptions struct {
	InputPath     string
	OutputDir     string       // If empty, uses same directory as input
	Format        AudioFormat  // Target audio format
	Quality       AudioQuality // Bitrate quality
	CustomBitrate int          // Custom bitrate in kbps, overrides Quality if > 0
	FFmpegPath    string
	CustomName    string // Custom output filename (without extension)
}

// AudioExtractResult contains the result of audio extraction
type AudioExtractResult struct {
	OutputPath string
	InputSize  int64
	OutputSize int64
	Duration   float64 // Duration in seconds (if available)
}

// ExtractAudio extracts audio from a video file and converts to specified format.
func ExtractAudio(opts AudioExtractOptions) (*AudioExtractResult, error) {
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

	var outputPath string
	if opts.CustomName != "" {
		outputPath = safeOutputPath(outputDir, opts.CustomName, "", string(opts.Format))
	} else {
		outputPath = filepath.Join(outputDir, baseName+"."+string(opts.Format))
	}

	// Build FFmpeg arguments
	args := []string{"-i", opts.InputPath, "-y", "-vn"} // -vn = no video

	// Get bitrate
	bitrate := getBitrateValue(opts.Quality)
	if opts.CustomBitrate > 0 {
		bitrate = opts.CustomBitrate
	}

	// Audio codec based on format
	switch opts.Format {
	case AudioFormatMP3:
		args = append(args, "-c:a", "libmp3lame", "-b:a", fmt.Sprintf("%dk", bitrate))
	case AudioFormatAAC, AudioFormatM4A:
		args = append(args, "-c:a", "aac", "-b:a", fmt.Sprintf("%dk", bitrate))
	case AudioFormatFLAC:
		// FLAC is lossless, no bitrate needed
		args = append(args, "-c:a", "flac")
	case AudioFormatWAV:
		// WAV is uncompressed PCM
		args = append(args, "-c:a", "pcm_s16le")
	case AudioFormatOGG:
		// Vorbis uses quality scale instead of bitrate
		quality := getVorbisQuality(bitrate)
		args = append(args, "-c:a", "libvorbis", "-q:a", fmt.Sprintf("%d", quality))
	case AudioFormatOPUS:
		args = append(args, "-c:a", "libopus", "-b:a", fmt.Sprintf("%dk", bitrate))
	default:
		return nil, fmt.Errorf("unsupported audio format: %s", opts.Format)
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

	return &AudioExtractResult{
		OutputPath: outputPath,
		InputSize:  inputInfo.Size(),
		OutputSize: outputInfo.Size(),
	}, nil
}

// getBitrateValue converts quality preset to bitrate in kbps
func getBitrateValue(quality AudioQuality) int {
	switch quality {
	case AudioQualityLow:
		return 128
	case AudioQualityMedium:
		return 192
	case AudioQualityHigh:
		return 256
	case AudioQualityBest:
		return 320
	default:
		return 192 // Medium as default
	}
}

// getVorbisQuality converts bitrate to Vorbis quality scale (0-10)
func getVorbisQuality(bitrate int) int {
	// Approximate mapping: 128kbps=4, 192kbps=5, 256kbps=6, 320kbps=8
	if bitrate >= 320 {
		return 8
	} else if bitrate >= 256 {
		return 6
	} else if bitrate >= 192 {
		return 5
	} else if bitrate >= 128 {
		return 4
	}
	return 3
}

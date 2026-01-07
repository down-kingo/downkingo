package converter

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// ImageFormat represents supported output image formats
type ImageFormat string

const (
	ImageFormatJPEG ImageFormat = "jpg"
	ImageFormatPNG  ImageFormat = "png"
	ImageFormatWebP ImageFormat = "webp"
	ImageFormatAVIF ImageFormat = "avif"
	ImageFormatBMP  ImageFormat = "bmp"
	ImageFormatTIFF ImageFormat = "tiff"
)

// ImageConvertOptions configures image conversion
type ImageConvertOptions struct {
	InputPath  string
	OutputDir  string      // If empty, uses same directory as input
	Format     ImageFormat // Target format
	Quality    int         // Quality 0-100 (100 = best, only for lossy formats)
	Width      int         // Target width (0 = keep original)
	Height     int         // Target height (0 = keep original)
	FFmpegPath string
}

// ImageConvertResult contains the result of image conversion
type ImageConvertResult struct {
	OutputPath string
	InputSize  int64
	OutputSize int64
}

// ConvertImage converts an image to another format using FFmpeg.
func ConvertImage(opts ImageConvertOptions) (*ImageConvertResult, error) {
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

	// Normalize quality (default to 85 if not specified)
	quality := opts.Quality
	if quality <= 0 {
		quality = 85
	}
	if quality > 100 {
		quality = 100
	}

	// Build output path
	inputExt := filepath.Ext(opts.InputPath)
	baseName := strings.TrimSuffix(filepath.Base(opts.InputPath), inputExt)
	outputDir := opts.OutputDir
	if outputDir == "" {
		outputDir = filepath.Dir(opts.InputPath)
	}

	// Handle JPEG extension
	ext := string(opts.Format)
	if opts.Format == ImageFormatJPEG {
		ext = "jpg"
	}
	outputPath := filepath.Join(outputDir, baseName+"_converted."+ext)

	// Build FFmpeg arguments
	args := []string{"-i", opts.InputPath, "-y"}

	// Resize if specified
	if opts.Width > 0 || opts.Height > 0 {
		w := opts.Width
		h := opts.Height
		if w == 0 {
			w = -1 // Maintain aspect ratio
		}
		if h == 0 {
			h = -1 // Maintain aspect ratio
		}
		args = append(args, "-vf", fmt.Sprintf("scale=%d:%d", w, h))
	}

	// Format-specific encoding settings
	switch opts.Format {
	case ImageFormatJPEG:
		// JPEG: -q:v range is 2-31 (lower is better quality)
		// Map 0-100 to 31-2
		qv := 31 - (quality * 29 / 100)
		if qv < 2 {
			qv = 2
		}
		args = append(args, "-q:v", fmt.Sprintf("%d", qv))

	case ImageFormatWebP:
		// WebP: libwebp -quality 0-100 (higher is better)
		args = append(args, "-c:v", "libwebp", "-quality", fmt.Sprintf("%d", quality))

	case ImageFormatAVIF:
		// AVIF: libaom-av1 with CRF mode
		// CRF range 0-63 (lower is better)
		// Map quality 100 -> CRF 10, quality 0 -> CRF 50
		crf := 50 - (quality * 40 / 100)
		if crf < 10 {
			crf = 10
		}
		args = append(args, "-c:v", "libaom-av1")
		args = append(args, "-crf", fmt.Sprintf("%d", crf))
		args = append(args, "-b:v", "0")           // Required for CRF mode
		args = append(args, "-cpu-used", "4")      // Encoding speed (0-8, higher=faster)
		args = append(args, "-still-picture", "1") // Optimize for still images

	case ImageFormatPNG:
		// PNG is lossless, no quality parameter
		// Use compression level instead (0-9, higher = smaller file, slower)
		compressionLevel := 6 // Default balanced
		args = append(args, "-compression_level", fmt.Sprintf("%d", compressionLevel))

	case ImageFormatBMP:
		// BMP is uncompressed, no special args needed

	case ImageFormatTIFF:
		// TIFF can use various compressions, using deflate
		args = append(args, "-compression_algo", "deflate")

	default:
		return nil, fmt.Errorf("unsupported image format: %s", opts.Format)
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

	return &ImageConvertResult{
		OutputPath: outputPath,
		InputSize:  inputInfo.Size(),
		OutputSize: outputInfo.Size(),
	}, nil
}

// CompressImage reduces image file size while keeping the same format.
func CompressImage(inputPath string, quality int, ffmpegPath string) (*ImageConvertResult, error) {
	// Detect input format
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(inputPath), "."))

	var format ImageFormat
	switch ext {
	case "jpg", "jpeg":
		format = ImageFormatJPEG
	case "png":
		format = ImageFormatPNG
	case "webp":
		format = ImageFormatWebP
	case "avif":
		format = ImageFormatAVIF
	case "bmp":
		format = ImageFormatBMP
	case "tiff", "tif":
		format = ImageFormatTIFF
	default:
		return nil, fmt.Errorf("unsupported image format for compression: %s", ext)
	}

	return ConvertImage(ImageConvertOptions{
		InputPath:  inputPath,
		Format:     format,
		Quality:    quality,
		FFmpegPath: ffmpegPath,
	})
}

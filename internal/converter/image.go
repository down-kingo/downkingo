package converter

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
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

// hasAlphaChannel returns true for formats that can carry an alpha channel.
func hasAlphaChannel(format ImageFormat) bool {
	switch format {
	case ImageFormatPNG, ImageFormatWebP, ImageFormatAVIF:
		return true
	default:
		return false
	}
}

// inputHasAlpha heuristically detects if the input likely carries transparency
// by checking its extension. A proper implementation would probe via ffprobe,
// but extension-based detection covers the vast majority of real-world cases.
func inputHasAlpha(inputPath string) bool {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(inputPath), "."))
	switch ext {
	case "png", "webp", "avif", "tiff", "tif":
		return true
	default:
		return false
	}
}

// safeOutputPath generates a non-colliding output path.
// If basename+suffix+ext already exists it appends a timestamp.
func safeOutputPath(outputDir, baseName, suffix, ext string) string {
	candidate := filepath.Join(outputDir, baseName+suffix+"."+ext)
	if _, err := os.Stat(candidate); os.IsNotExist(err) {
		return candidate
	}
	ts := time.Now().Format("20060102_150405")
	return filepath.Join(outputDir, baseName+suffix+"_"+ts+"."+ext)
}

// ImageConvertOptions configures image conversion
type ImageConvertOptions struct {
	InputPath   string
	OutputDir   string      // If empty, uses same directory as input
	Format      ImageFormat // Target format
	Quality     int         // Quality 0-100 (100 = best, only for lossy formats)
	Width       int         // Target width (0 = keep original)
	Height      int         // Target height (0 = keep original)
	FFmpegPath  string
	AvifencPath string // Path to avifenc binary (used for AVIF output)
	CustomName  string // Custom output filename (without extension)
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

	// Build output path (anti-collision)
	inputExt := filepath.Ext(opts.InputPath)
	baseName := strings.TrimSuffix(filepath.Base(opts.InputPath), inputExt)
	outputDir := opts.OutputDir
	if outputDir == "" {
		outputDir = filepath.Dir(opts.InputPath)
	}

	ext := string(opts.Format)
	var outputPath string
	if opts.CustomName != "" {
		outputPath = safeOutputPath(outputDir, opts.CustomName, "", ext)
	} else {
		outputPath = safeOutputPath(outputDir, baseName, "_converted", ext)
	}

	// Build FFmpeg arguments
	args := []string{"-i", opts.InputPath, "-y"}

	// Determine if we need to preserve alpha channel
	preserveAlpha := inputHasAlpha(opts.InputPath) && hasAlphaChannel(opts.Format)

	needsResize := opts.Width > 0 || opts.Height > 0

	// Resize if specified — keep alpha-compatible scaling filter
	if needsResize {
		w := opts.Width
		h := opts.Height
		if w == 0 {
			w = -1
		}
		if h == 0 {
			h = -1
		}
		args = append(args, "-vf", fmt.Sprintf("scale=%d:%d", w, h))
	}

	// useAvifenc is set to true when the target is AVIF — encoding is delegated to avifenc
	useAvifenc := false

	// Format-specific encoding settings
	switch opts.Format {
	case ImageFormatJPEG:
		// JPEG has no alpha. Composite over white background to avoid green cast.
		if inputHasAlpha(opts.InputPath) {
			args = append(args, "-vf", "color=white,format=rgb24[bg];[bg][0:v]scale2ref[bg2][fg];[bg2][fg]overlay,format=rgb24")
		}
		// JPEG: -q:v range is 2-31 (lower is better quality)
		qv := 31 - (quality * 29 / 100)
		if qv < 2 {
			qv = 2
		}
		args = append(args, "-q:v", fmt.Sprintf("%d", qv))

	case ImageFormatWebP:
		if preserveAlpha {
			// Lossless mode is the only reliable way to preserve alpha in WebP
			args = append(args, "-c:v", "libwebp", "-lossless", "1")
		} else {
			args = append(args, "-c:v", "libwebp", "-quality", fmt.Sprintf("%d", quality))
		}

	case ImageFormatAVIF:
		// AVIF is handled by avifenc after FFmpeg loop — skip FFmpeg encoding here
		useAvifenc = true

	case ImageFormatPNG:
		// PNG is lossless; preserve alpha by ensuring rgba pix_fmt
		args = append(args, "-pix_fmt", "rgba")
		compressionLevel := 6
		args = append(args, "-compression_level", fmt.Sprintf("%d", compressionLevel))

	case ImageFormatBMP:
		// BMP is uncompressed, no special args needed

	case ImageFormatTIFF:
		args = append(args, "-compression_algo", "deflate")

	default:
		return nil, fmt.Errorf("unsupported image format: %s", opts.Format)
	}

	if useAvifenc {
		// AVIF: delegate encoding to avifenc
		avifencInput := opts.InputPath
		var tempPNG string

		if needsResize {
			// FFmpeg resizes to a temporary PNG, then avifenc encodes
			tempPNG = outputPath + ".tmp.png"
			resizeArgs := append(args, "-pix_fmt", "rgba", tempPNG)
			cmd := exec.Command(opts.FFmpegPath, resizeArgs...)
			setSysProcAttr(cmd)
			out, err := cmd.CombinedOutput()
			if err != nil {
				return nil, fmt.Errorf("ffmpeg resize error: %v | output: %s", err, string(out))
			}
			avifencInput = tempPNG
			defer os.Remove(tempPNG)
		}

		if err := runAvifenc(opts.AvifencPath, avifencInput, outputPath, quality); err != nil {
			return nil, err
		}
	} else {
		args = append(args, outputPath)

		// Execute FFmpeg
		cmd := exec.Command(opts.FFmpegPath, args...)
		setSysProcAttr(cmd)

		output, err := cmd.CombinedOutput()
		if err != nil {
			return nil, fmt.Errorf("ffmpeg error: %v | output: %s", err, string(output))
		}
	}

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
// Uses "_compressed" suffix (not "_converted") and anti-collision timestamp.
func CompressImage(inputPath string, quality int, ffmpegPath string, avifencPath string) (*ImageConvertResult, error) {
	if ffmpegPath == "" {
		return nil, fmt.Errorf("ffmpeg path is required")
	}

	if _, err := os.Stat(inputPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("input file does not exist: %s", inputPath)
	}

	inputInfo, err := os.Stat(inputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat input file: %w", err)
	}

	// Normalize quality
	if quality <= 0 {
		quality = 85
	}
	if quality > 100 {
		quality = 100
	}

	// Detect input format
	rawExt := strings.ToLower(strings.TrimPrefix(filepath.Ext(inputPath), "."))
	if rawExt == "jpeg" {
		rawExt = "jpg"
	}

	var format ImageFormat
	switch rawExt {
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
		return nil, fmt.Errorf("unsupported image format for compression: %s", rawExt)
	}

	// Build output path with "_compressed" suffix (distinct from "_converted")
	inputExt := filepath.Ext(inputPath)
	baseName := strings.TrimSuffix(filepath.Base(inputPath), inputExt)
	outputDir := filepath.Dir(inputPath)
	outputPath := safeOutputPath(outputDir, baseName, "_compressed", rawExt)

	useAvifenc := false

	// Build FFmpeg arguments
	args := []string{"-i", inputPath, "-y"}

	preserveAlpha := inputHasAlpha(inputPath) && hasAlphaChannel(format)

	switch format {
	case ImageFormatJPEG:
		qv := 31 - (quality * 29 / 100)
		if qv < 2 {
			qv = 2
		}
		args = append(args, "-q:v", fmt.Sprintf("%d", qv))

	case ImageFormatWebP:
		if preserveAlpha {
			args = append(args, "-c:v", "libwebp", "-lossless", "1")
		} else {
			args = append(args, "-c:v", "libwebp", "-quality", fmt.Sprintf("%d", quality))
		}

	case ImageFormatAVIF:
		useAvifenc = true

	case ImageFormatPNG:
		args = append(args, "-pix_fmt", "rgba")
		args = append(args, "-compression_level", "6")

	case ImageFormatBMP:
		// no-op

	case ImageFormatTIFF:
		args = append(args, "-compression_algo", "deflate")
	}

	if useAvifenc {
		if err := runAvifenc(avifencPath, inputPath, outputPath, quality); err != nil {
			return nil, err
		}
	} else {
		args = append(args, outputPath)

		cmd := exec.Command(ffmpegPath, args...)
		setSysProcAttr(cmd)

		out, err := cmd.CombinedOutput()
		if err != nil {
			return nil, fmt.Errorf("ffmpeg error: %v | output: %s", err, string(out))
		}
	}

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

// runAvifenc encodes an image to AVIF using the avifenc CLI.
// Uses -q (color quality) and --qalpha (alpha quality) flags.
// quality is 0-100 where 100 is lossless (maps directly to avifenc's scale).
func runAvifenc(avifencPath, inputPath, outputPath string, quality int) error {
	if avifencPath == "" {
		return fmt.Errorf("avifenc path is required for AVIF encoding")
	}

	args := []string{
		"-q", fmt.Sprintf("%d", quality),
		"--qalpha", fmt.Sprintf("%d", quality),
		"-s", "4",
		inputPath,
		outputPath,
	}

	cmd := exec.Command(avifencPath, args...)
	setSysProcAttr(cmd)

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("avifenc error: %v | output: %s", err, string(out))
	}
	return nil
}

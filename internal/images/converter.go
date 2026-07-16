package images

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Convert transcodifica e redimensiona a imagem usando FFmpeg.
// Retorna o caminho do arquivo convertido.
// Se format for "original" e scalePercent for 100, retorna o inputPath.
func Convert(inputPath string, format string, quality, scalePercent int, ffmpegPath string, avifencPath string) (string, error) {
	format = strings.ToLower(strings.TrimSpace(format))
	if format == "" {
		format = "original"
	}
	if format == "jpeg" {
		format = "jpg"
	}
	allowedFormats := map[string]bool{
		"original": true,
		"jpg":      true,
		"png":      true,
		"webp":     true,
		"avif":     true,
	}
	if !allowedFormats[format] {
		return "", fmt.Errorf("unsupported image format: %s", format)
	}
	if scalePercent == 0 {
		scalePercent = 100
	}
	if scalePercent < 10 || scalePercent > 400 {
		return "", fmt.Errorf("image scale must be between 10 and 400 percent")
	}
	if quality <= 0 || quality > 100 {
		quality = 100
	}

	if format == "original" && scalePercent == 100 {
		return inputPath, nil
	}

	ext := strings.ToLower(filepath.Ext(inputPath))
	if ext == "" {
		return "", fmt.Errorf("input image has no file extension")
	}
	targetExt := ext
	if format != "original" {
		targetExt = "." + format
	}

	basePath := strings.TrimSuffix(inputPath, ext)
	sameExtension := ext == targetExt
	outputPath := basePath + targetExt
	if sameExtension {
		outputPath = basePath + ".downkingo-resized" + targetExt
	}
	scaleFilter := fmt.Sprintf("scale=round(iw*%d/100):round(ih*%d/100):flags=lanczos", scalePercent, scalePercent)

	args := []string{"-i", inputPath, "-y"}
	if scalePercent != 100 {
		args = append(args, "-vf", scaleFilter)
	}

	// Mapeamento de qualidade (0-100 input)
	switch targetExt {
	case ".jpg":
		// FFmpeg -q:v range 2-31 (lower is better)
		// 100 -> 2
		// 0   -> 31
		q := 31 - (quality * 29 / 100)
		if q < 2 {
			q = 2
		}
		args = append(args, "-q:v", fmt.Sprintf("%d", q))

	case ".webp":
		// FFmpeg libwebp -q:v 0-100 (higher is better)
		args = append(args, "-q:v", fmt.Sprintf("%d", quality))

	case ".avif":
		if avifencPath == "" {
			return "", fmt.Errorf("avifenc path is required for AVIF encoding")
		}
		avifInput := inputPath
		resizedInput := ""
		if scalePercent != 100 {
			resizedInput = basePath + ".downkingo-resized.png"
			resizeArgs := []string{"-i", inputPath, "-y", "-vf", scaleFilter, resizedInput}
			resizeCmd := exec.Command(ffmpegPath, resizeArgs...)
			resizeCmd.SysProcAttr = getSysProcAttr()
			if resizeOutput, resizeErr := resizeCmd.CombinedOutput(); resizeErr != nil {
				return "", fmt.Errorf("ffmpeg resize error: %v | output: %s", resizeErr, string(resizeOutput))
			}
			defer os.Remove(resizedInput)
			avifInput = resizedInput
		}
		avifArgs := []string{
			"-q", fmt.Sprintf("%d", quality),
			"--qalpha", fmt.Sprintf("%d", quality),
			"-s", "4",
			avifInput,
			outputPath,
		}
		avifCmd := exec.Command(avifencPath, avifArgs...)
		avifCmd.SysProcAttr = getSysProcAttr()
		avifOut, avifErr := avifCmd.CombinedOutput()
		if avifErr != nil {
			return "", fmt.Errorf("avifenc error: %v | output: %s", avifErr, string(avifOut))
		}
		return replaceConvertedInput(inputPath, outputPath, sameExtension)

	case ".png":
		// PNG é lossless ou compression level. Ignorar quality parameter.
	}

	args = append(args, outputPath)

	cmd := exec.Command(ffmpegPath, args...)

	// Configuração de processo específica da plataforma (Windows: esconde console)
	cmd.SysProcAttr = getSysProcAttr()

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg error: %v | output: %s", err, string(output))
	}

	return replaceConvertedInput(inputPath, outputPath, sameExtension)
}

func replaceConvertedInput(inputPath, outputPath string, sameExtension bool) (string, error) {
	if err := os.Remove(inputPath); err != nil {
		return "", fmt.Errorf("remove source image after conversion: %w", err)
	}
	if !sameExtension {
		return outputPath, nil
	}
	if err := os.Rename(outputPath, inputPath); err != nil {
		return outputPath, fmt.Errorf("activate resized image: %w", err)
	}
	return inputPath, nil
}

package images

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Convert transcodifica a imagem usando FFmpeg.
// Retorna o caminho do arquivo convertido.
// Se format for "original", retorna o inputPath.
func Convert(inputPath string, format string, quality int, ffmpegPath string, avifencPath string) (string, error) {
	if format == "original" || format == "" {
		return inputPath, nil
	}

	ext := strings.ToLower(filepath.Ext(inputPath))
	// Formato alvo
	targetExt := "." + strings.ToLower(format)
	if targetExt == ".jpeg" {
		targetExt = ".jpg"
	}

	// Se já está no formato, retorna
	if ext == targetExt {
		return inputPath, nil
	}

	outputPath := strings.TrimSuffix(inputPath, ext) + targetExt

	args := []string{"-i", inputPath, "-y"}

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
		// AVIF encoding is delegated to avifenc — skip FFmpeg for this format
		if avifencPath == "" {
			return "", fmt.Errorf("avifenc path is required for AVIF encoding")
		}
		avifArgs := []string{
			"-q", fmt.Sprintf("%d", quality),
			"--qalpha", fmt.Sprintf("%d", quality),
			"-s", "4",
			inputPath,
			outputPath,
		}
		avifCmd := exec.Command(avifencPath, avifArgs...)
		avifCmd.SysProcAttr = getSysProcAttr()
		avifOut, avifErr := avifCmd.CombinedOutput()
		if avifErr != nil {
			return "", fmt.Errorf("avifenc error: %v | output: %s", avifErr, string(avifOut))
		}
		// Remove original after successful conversion
		if err := os.Remove(inputPath); err != nil {
			fmt.Printf("Warning: failed to remove original file: %v\n", err)
		}
		return outputPath, nil

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

	// Deletar o original após conversão bem sucedida
	if err := os.Remove(inputPath); err != nil {
		// Log warning but don't fail?
		fmt.Printf("Warning: failed to remove original file: %v\n", err)
	}

	return outputPath, nil
}

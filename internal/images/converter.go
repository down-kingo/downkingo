package images

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// Convert transcodifica a imagem usando FFmpeg.
// Retorna o caminho do arquivo convertido.
// Se format for "original", retorna o inputPath.
func Convert(inputPath string, format string, quality int, ffmpegPath string) (string, error) {
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
		// libaom-av1 -crf 0-63 (lower is better)
		// Recomendado 20-30. Vamos usar range "safe" 20-50 para speed.
		// 100 -> 20
		// 0   -> 50
		crf := 50 - (quality * 30 / 100)
		args = append(args, "-c:v", "libaom-av1", "-crf", fmt.Sprintf("%d", crf))
		args = append(args, "-cpu-used", "4") // Balance speed

	case ".png":
		// PNG é lossless ou compression level. Ignorar quality parameter.
	}

	args = append(args, outputPath)

	cmd := exec.Command(ffmpegPath, args...)

	// Evitar abrir janela de console no Windows
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

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

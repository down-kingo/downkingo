package whisper

import (
	"archive/zip"
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"kingo/internal/logger"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// TranscribeResult holds the result of a transcription.
type TranscribeResult struct {
	Text     string    `json:"text"`
	Segments []Segment `json:"segments"`
	Language string    `json:"language"`
	Duration float64   `json:"duration"`
}

// Segment represents a timestamped segment of transcription.
type Segment struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Text  string  `json:"text"`
}

// ModelInfo holds metadata about a whisper model.
type ModelInfo struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	Path string `json:"path"`
}

// AvailableModel describes a model available for download.
type AvailableModel struct {
	Name        string `json:"name"`
	Size        string `json:"size"`
	Description string `json:"description"`
}

// Client manages whisper.cpp binary and models.
type Client struct {
	ctx        context.Context
	whisperDir string
	modelsDir  string
}

// NewClient creates a new whisper client.
func NewClient(whisperDir string) *Client {
	modelsDir := filepath.Join(whisperDir, "models")
	return &Client{
		whisperDir: whisperDir,
		modelsDir:  modelsDir,
	}
}

// SetContext sets the Wails context.
func (c *Client) SetContext(ctx context.Context) {
	c.ctx = ctx
}

// EnsureDirectories creates required directories.
func (c *Client) EnsureDirectories() error {
	if err := os.MkdirAll(c.whisperDir, 0755); err != nil {
		return err
	}
	return os.MkdirAll(c.modelsDir, 0755)
}

// binaryPath returns the path to the whisper-cli binary.
func (c *Client) binaryPath() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(c.whisperDir, "whisper-cli.exe")
	}
	return filepath.Join(c.whisperDir, "whisper-cli")
}

// IsBinaryInstalled checks if the whisper binary exists.
func (c *Client) IsBinaryInstalled() bool {
	info, err := os.Stat(c.binaryPath())
	return err == nil && !info.IsDir() && info.Size() > 0
}

// whisperBinaryURL returns the download URL for the whisper.cpp pre-compiled binary.
func whisperBinaryURL() (string, string, error) {
	switch runtime.GOOS {
	case "windows":
		if runtime.GOARCH == "amd64" || runtime.GOARCH == "arm64" {
			return "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-x64.zip", "zip", nil
		}
		return "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-Win32.zip", "zip", nil
	default:
		return "", "", fmt.Errorf("automatic whisper download is not available for %s, please compile from source: https://github.com/ggml-org/whisper.cpp", runtime.GOOS)
	}
}

// DownloadBinary downloads and installs the whisper.cpp binary.
func (c *Client) DownloadBinary() error {
	if c.IsBinaryInstalled() {
		return nil
	}

	if err := c.EnsureDirectories(); err != nil {
		return err
	}

	url, archiveType, err := whisperBinaryURL()
	if err != nil {
		return err
	}

	logger.Log.Info().Str("url", url).Msg("downloading whisper binary")

	c.emitEvent("whisper:binary-progress", map[string]interface{}{
		"status":  "downloading",
		"percent": 0,
	})

	req, err := http.NewRequestWithContext(c.ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "DownKingo-Launcher/3.0")

	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	tmpPath := filepath.Join(c.whisperDir, "whisper-download.tmp")
	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}

	total := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := out.Write(buf[:n]); writeErr != nil {
				out.Close()
				os.Remove(tmpPath)
				return writeErr
			}
			downloaded += int64(n)
			if total > 0 {
				percent := float64(downloaded) / float64(total) * 100
				c.emitEvent("whisper:binary-progress", map[string]interface{}{
					"status":     "downloading",
					"percent":    percent,
					"downloaded": downloaded,
					"total":      total,
				})
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			out.Close()
			os.Remove(tmpPath)
			return readErr
		}
	}
	out.Close()

	c.emitEvent("whisper:binary-progress", map[string]interface{}{
		"status":  "extracting",
		"percent": 100,
	})

	if archiveType == "zip" {
		if err := c.extractWhisperFromZip(tmpPath); err != nil {
			os.Remove(tmpPath)
			return fmt.Errorf("extraction failed: %w", err)
		}
	}

	os.Remove(tmpPath)

	c.emitEvent("whisper:binary-progress", map[string]interface{}{
		"status":  "complete",
		"percent": 100,
	})

	logger.Log.Info().Msg("whisper binary installed successfully")
	return nil
}

// extractWhisperFromZip extracts whisper-cli from the zip archive.
func (c *Client) extractWhisperFromZip(zipPath string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	// Look for whisper-cli binary inside the zip
	targetName := "whisper-cli.exe"
	if runtime.GOOS != "windows" {
		targetName = "whisper-cli"
	}

	for _, f := range r.File {
		baseName := filepath.Base(f.Name)
		if baseName != targetName {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		outPath := filepath.Join(c.whisperDir, targetName)
		out, err := os.Create(outPath)
		if err != nil {
			rc.Close()
			return err
		}

		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()

		if err != nil {
			return err
		}

		if runtime.GOOS != "windows" {
			os.Chmod(outPath, 0755)
		}

		logger.Log.Info().Str("path", outPath).Msg("whisper-cli extracted")
		return nil
	}

	// Fallback: try main.exe or whisper.exe
	for _, f := range r.File {
		baseName := filepath.Base(f.Name)
		if baseName == "main.exe" || baseName == "whisper.exe" || baseName == "main" || baseName == "whisper" {
			rc, err := f.Open()
			if err != nil {
				return err
			}

			outPath := filepath.Join(c.whisperDir, targetName)
			out, err := os.Create(outPath)
			if err != nil {
				rc.Close()
				return err
			}

			_, err = io.Copy(out, rc)
			out.Close()
			rc.Close()

			if err != nil {
				return err
			}

			if runtime.GOOS != "windows" {
				os.Chmod(outPath, 0755)
			}

			logger.Log.Info().Str("path", outPath).Str("originalName", baseName).Msg("whisper binary extracted (renamed)")
			return nil
		}
	}

	return fmt.Errorf("whisper-cli not found in archive")
}

// GetAvailableModels returns the list of models that can be downloaded.
func (c *Client) GetAvailableModels() []AvailableModel {
	return []AvailableModel{
		{Name: "tiny", Size: "~75 MB", Description: "Fastest, basic quality"},
		{Name: "base", Size: "~150 MB", Description: "Fast, good quality"},
		{Name: "small", Size: "~500 MB", Description: "Medium speed, very good quality"},
		{Name: "medium", Size: "~1.5 GB", Description: "Slow, excellent quality"},
		{Name: "large-v3-turbo", Size: "~1.6 GB", Description: "Best quality/speed ratio"},
	}
}

// ListModels lists downloaded models in the models directory.
func (c *Client) ListModels() ([]ModelInfo, error) {
	if err := c.EnsureDirectories(); err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(c.modelsDir)
	if err != nil {
		return nil, err
	}

	var models []ModelInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasPrefix(name, "ggml-") || !strings.HasSuffix(name, ".bin") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		// Extract model name: ggml-base.bin -> base
		modelName := strings.TrimPrefix(name, "ggml-")
		modelName = strings.TrimSuffix(modelName, ".bin")

		models = append(models, ModelInfo{
			Name: modelName,
			Size: info.Size(),
			Path: filepath.Join(c.modelsDir, name),
		})
	}

	return models, nil
}

// DownloadModel downloads a whisper model from HuggingFace.
func (c *Client) DownloadModel(modelName string) error {
	if err := c.EnsureDirectories(); err != nil {
		return err
	}

	fileName := fmt.Sprintf("ggml-%s.bin", modelName)
	destPath := filepath.Join(c.modelsDir, fileName)

	// Check if already exists
	if info, err := os.Stat(destPath); err == nil && info.Size() > 0 {
		return nil
	}

	url := fmt.Sprintf("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/%s", fileName)

	logger.Log.Info().Str("model", modelName).Str("url", url).Msg("downloading whisper model")

	c.emitEvent("whisper:model-progress", map[string]interface{}{
		"model":  modelName,
		"status": "downloading",
		"percent": 0,
	})

	req, err := http.NewRequestWithContext(c.ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 60 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	tmpPath := destPath + ".tmp"
	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}

	total := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			_, writeErr := out.Write(buf[:n])
			if writeErr != nil {
				out.Close()
				os.Remove(tmpPath)
				return writeErr
			}
			downloaded += int64(n)

			if total > 0 {
				percent := float64(downloaded) / float64(total) * 100
				c.emitEvent("whisper:model-progress", map[string]interface{}{
					"model":      modelName,
					"status":     "downloading",
					"percent":    percent,
					"downloaded": downloaded,
					"total":      total,
				})
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			out.Close()
			os.Remove(tmpPath)
			return readErr
		}
	}
	out.Close()

	if err := os.Rename(tmpPath, destPath); err != nil {
		os.Remove(tmpPath)
		return err
	}

	c.emitEvent("whisper:model-progress", map[string]interface{}{
		"model":   modelName,
		"status":  "complete",
		"percent": 100,
	})

	logger.Log.Info().Str("model", modelName).Msg("whisper model downloaded")
	return nil
}

// DeleteModel removes a downloaded model.
func (c *Client) DeleteModel(modelName string) error {
	fileName := fmt.Sprintf("ggml-%s.bin", modelName)
	modelPath := filepath.Join(c.modelsDir, fileName)

	if err := os.Remove(modelPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	logger.Log.Info().Str("model", modelName).Msg("whisper model deleted")
	return nil
}

// TranscribeFile transcribes an audio/video file using whisper.cpp.
func (c *Client) TranscribeFile(filePath, modelName, language, outputFormat string) (*TranscribeResult, error) {
	binaryPath := c.binaryPath()
	if _, err := os.Stat(binaryPath); err != nil {
		return nil, fmt.Errorf("whisper binary not found at %s", binaryPath)
	}

	modelFile := fmt.Sprintf("ggml-%s.bin", modelName)
	modelPath := filepath.Join(c.modelsDir, modelFile)
	if _, err := os.Stat(modelPath); err != nil {
		return nil, fmt.Errorf("model %s not found", modelName)
	}

	c.emitEvent("whisper:transcribe-progress", map[string]interface{}{
		"status": "processing",
		"file":   filepath.Base(filePath),
	})

	args := []string{
		"-m", modelPath,
		"-f", filePath,
		"--no-timestamps",
	}

	if language != "" && language != "auto" {
		args = append(args, "-l", language)
	}

	// For SRT/VTT output we need timestamps
	if outputFormat == "srt" || outputFormat == "vtt" {
		// Remove --no-timestamps and add output format
		args = []string{
			"-m", modelPath,
			"-f", filePath,
		}
		if language != "" && language != "auto" {
			args = append(args, "-l", language)
		}
		if outputFormat == "srt" {
			args = append(args, "--output-srt")
		} else if outputFormat == "vtt" {
			args = append(args, "--output-vtt")
		}
	}

	logger.Log.Info().
		Str("binary", binaryPath).
		Strs("args", args).
		Msg("running whisper transcription")

	cmd := exec.CommandContext(c.ctx, binaryPath, args...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start whisper: %w", err)
	}

	// Read stderr for progress in background
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			logger.Log.Debug().Str("whisper-stderr", line).Msg("")
			c.emitEvent("whisper:transcribe-progress", map[string]interface{}{
				"status": "processing",
				"detail": line,
			})
		}
	}()

	// Read full stdout
	outputBytes, err := io.ReadAll(stdout)
	if err != nil {
		return nil, err
	}

	if err := cmd.Wait(); err != nil {
		return nil, fmt.Errorf("whisper exited with error: %w", err)
	}

	text := strings.TrimSpace(string(outputBytes))

	c.emitEvent("whisper:transcribe-progress", map[string]interface{}{
		"status": "complete",
	})

	return &TranscribeResult{
		Text:     text,
		Language: language,
	}, nil
}

// emitEvent emits a Wails event.
func (c *Client) emitEvent(eventName string, data interface{}) {
	if app := application.Get(); app != nil {
		app.Event.Emit(eventName, data)
	}
}

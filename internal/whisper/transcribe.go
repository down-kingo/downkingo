package whisper

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"kingo/internal/logger"
)

const transcriptionTimeout = 2 * time.Hour

type whisperJSONResult struct {
	Result struct {
		Language string `json:"language"`
	} `json:"result"`
	Transcription []struct {
		Offsets struct {
			From int64 `json:"from"`
			To   int64 `json:"to"`
		} `json:"offsets"`
		Text string `json:"text"`
	} `json:"transcription"`
}

func (c *Client) convertToWav(ctx context.Context, inputPath, workDir string) (string, error) {
	if c.ffmpegPath == "" {
		return "", fmt.Errorf("ffmpeg not found; it is required to normalize audio for whisper")
	}
	if ctx == nil {
		ctx = c.baseContext()
	}
	outputPath := filepath.Join(workDir, "input.wav")
	args := []string{"-y", "-i", inputPath, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", outputPath}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, c.ffmpegPath, args...)
	hideWindow(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg conversion failed: %w: %s", err, strings.TrimSpace(string(output)))
	}
	if info, err := os.Stat(outputPath); err != nil || info.Size() == 0 {
		return "", fmt.Errorf("ffmpeg did not create normalized audio")
	}
	return outputPath, nil
}

func parseWhisperJSON(data []byte, outputFormat string) (*TranscribeResult, error) {
	var payload whisperJSONResult
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("invalid whisper JSON output: %w", err)
	}
	segments := make([]Segment, 0, len(payload.Transcription))
	for _, item := range payload.Transcription {
		text := strings.TrimSpace(item.Text)
		if text == "" {
			continue
		}
		segments = append(segments, Segment{Start: float64(item.Offsets.From) / 1000, End: float64(item.Offsets.To) / 1000, Text: text})
	}
	var text string
	switch outputFormat {
	case "srt":
		text = formatSRT(segments)
	case "vtt":
		text = formatVTT(segments)
	case "", "txt", "docx":
		text = buildPlainText(segments)
	default:
		return nil, fmt.Errorf("unsupported transcription output format: %s", outputFormat)
	}
	var duration float64
	if len(segments) > 0 {
		duration = segments[len(segments)-1].End
	}
	return &TranscribeResult{Text: text, Segments: segments, Language: strings.ToLower(payload.Result.Language), Duration: duration}, nil
}

func (c *Client) TranscribeFile(filePath, modelName, language, outputFormat string, useVAD bool) (*TranscribeResult, error) {
	return c.TranscribeFileContext(c.baseContext(), filePath, modelName, language, outputFormat, useVAD)
}

// TranscribeFileContext is the cancellable variant used by queued downloads.
// The public TranscribeFile method keeps the existing app-lifetime behavior.
func (c *Client) TranscribeFileContext(ctx context.Context, filePath, modelName, language, outputFormat string, useVAD bool) (*TranscribeResult, error) {
	if ctx == nil {
		ctx = c.baseContext()
	}
	if err := c.validateRuntime(c.supportedRuntimeDir()); err != nil {
		return nil, fmt.Errorf("whisper runtime is not ready: %w", err)
	}
	inputInfo, err := os.Stat(filePath)
	if err != nil || inputInfo.IsDir() {
		return nil, fmt.Errorf("media file not found: %s", filePath)
	}
	spec, ok := findModelSpec(modelName)
	if !ok {
		return nil, fmt.Errorf("unsupported whisper model: %s", modelName)
	}
	modelPath := filepath.Join(c.modelsDir, spec.FileName)
	if err := verifyInstalledModel(modelPath, spec); err != nil {
		return nil, fmt.Errorf("whisper model is missing, incomplete, or corrupt (%s): %w", modelName, err)
	}
	if language == "" {
		language = "auto"
	}
	language = strings.ToLower(language)
	if !validLanguages[language] {
		return nil, fmt.Errorf("unsupported language code: %s", language)
	}

	workDir, err := os.MkdirTemp("", "downkingo-whisper-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(workDir)

	c.emitEvent("whisper:transcribe-progress", map[string]interface{}{"status": "converting", "file": filepath.Base(filePath)})
	wavPath, err := c.convertToWav(ctx, filePath, workDir)
	if err != nil {
		return nil, err
	}
	outputBase := filepath.Join(workDir, "result")
	args := []string{"-m", modelPath, "-f", wavPath, "-l", language, "-oj", "-of", outputBase, "-np"}
	if useVAD {
		c.emitEvent("whisper:transcribe-progress", map[string]interface{}{"status": "preparing-vad", "file": filepath.Base(filePath)})
		vadPath, err := c.ensureVADModel()
		if err != nil {
			return nil, fmt.Errorf("could not prepare VAD model: %w", err)
		}
		args = append(args, "--vad", "-vm", vadPath)
	}

	c.emitEvent("whisper:transcribe-progress", map[string]interface{}{"status": "processing", "file": filepath.Base(filePath)})
	ctx, cancel := context.WithTimeout(ctx, transcriptionTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, c.binaryPath(), args...)
	cmd.Dir = c.supportedRuntimeDir()
	hideWindow(cmd)
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

	var wg sync.WaitGroup
	var stderrLines []string
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, _ = io.Copy(io.Discard, stdout)
	}()
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			stderrLines = append(stderrLines, line)
			logger.Log.Debug().Str("whisper-stderr", line).Msg("")
		}
	}()
	wg.Wait()
	if err := cmd.Wait(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("whisper transcription timed out after %s", transcriptionTimeout)
		}
		detail := ""
		if len(stderrLines) > 0 {
			detail = ": " + stderrLines[len(stderrLines)-1]
		}
		return nil, fmt.Errorf("whisper exited with error: %w%s", err, detail)
	}

	jsonPath := outputBase + ".json"
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return nil, fmt.Errorf("whisper did not produce JSON output: %w", err)
	}
	result, err := parseWhisperJSON(data, outputFormat)
	if err != nil {
		return nil, err
	}
	c.emitEvent("whisper:transcribe-language", map[string]interface{}{"language": result.Language})
	c.emitEvent("whisper:transcribe-progress", map[string]interface{}{"status": "complete"})
	return result, nil
}

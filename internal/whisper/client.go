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
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"kingo/internal/logger"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// validLanguages are the language codes accepted by whisper.cpp.
var validLanguages = map[string]bool{
	"auto": true, "af": true, "am": true, "ar": true, "as": true, "az": true,
	"ba": true, "be": true, "bg": true, "bn": true, "bo": true, "br": true,
	"bs": true, "ca": true, "cs": true, "cy": true, "da": true, "de": true,
	"el": true, "en": true, "es": true, "et": true, "eu": true, "fa": true,
	"fi": true, "fo": true, "fr": true, "gl": true, "gu": true, "ha": true,
	"haw": true, "he": true, "hi": true, "hr": true, "ht": true, "hu": true,
	"hy": true, "id": true, "is": true, "it": true, "ja": true, "jw": true,
	"ka": true, "kk": true, "km": true, "kn": true, "ko": true, "la": true,
	"lb": true, "ln": true, "lo": true, "lt": true, "lv": true, "mg": true,
	"mi": true, "mk": true, "ml": true, "mn": true, "mr": true, "ms": true,
	"mt": true, "my": true, "ne": true, "nl": true, "nn": true, "no": true,
	"oc": true, "pa": true, "pl": true, "ps": true, "pt": true, "ro": true,
	"ru": true, "sa": true, "sd": true, "si": true, "sk": true, "sl": true,
	"sn": true, "so": true, "sq": true, "sr": true, "su": true, "sv": true,
	"sw": true, "ta": true, "te": true, "tg": true, "th": true, "tk": true,
	"tl": true, "tr": true, "tt": true, "uk": true, "ur": true, "uz": true,
	"vi": true, "yi": true, "yo": true, "zh": true,
}

// timestampRe matches whisper timestamp lines: [00:00:00.000 --> 00:00:05.000]  text
var timestampRe = regexp.MustCompile(`^\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.*)$`)

// langDetectRe extrai o código de idioma do output do whisper -dl.
// Exemplos de saídas conhecidas:
//
//	whisper_full: auto-detected language: pt (p = 0.92)
//	whisper_lang_id: detected language 'pt' with probability 0.92
var langDetectRe = regexp.MustCompile(`(?i)(?:auto-detected language|detected language)[:\s'"]+([a-z]{2,3})`)

// transcriptionTimeout is the maximum duration for a single transcription.
const transcriptionTimeout = 2 * time.Hour

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
	ffmpegPath string // needed to convert non-WAV files before transcription
}

// NewClient creates a new whisper client.
// ffmpegPath é obrigatório: o binário padrão do whisper.cpp só aceita WAV 16-bit.
func NewClient(whisperDir, ffmpegPath string) *Client {
	modelsDir := filepath.Join(whisperDir, "models")
	return &Client{
		whisperDir: whisperDir,
		modelsDir:  modelsDir,
		ffmpegPath: ffmpegPath,
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

// IsBinaryInstalled checks if the whisper binary and required dependencies exist.
func (c *Client) IsBinaryInstalled() bool {
	info, err := os.Stat(c.binaryPath())
	if err != nil || info.IsDir() || info.Size() == 0 {
		return false
	}

	// On Windows, check that at least one DLL exists alongside the binary
	if runtime.GOOS == "windows" {
		entries, err := os.ReadDir(c.whisperDir)
		if err != nil {
			return false
		}
		hasDLL := false
		for _, e := range entries {
			if strings.HasSuffix(strings.ToLower(e.Name()), ".dll") {
				hasDLL = true
				break
			}
		}
		if !hasDLL {
			// Binary exists but DLLs are missing — needs reinstall
			logger.Log.Warn().Msg("whisper binary found but DLLs are missing, will re-download")
			os.Remove(c.binaryPath())
			return false
		}
	}

	return true
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

// extractWhisperFromZip extracts whisper-cli and all required DLLs from the zip archive.
func (c *Client) extractWhisperFromZip(zipPath string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	targetName := "whisper-cli.exe"
	if runtime.GOOS != "windows" {
		targetName = "whisper-cli"
	}

	foundBinary := false

	// Extract all files from the zip (binary + DLLs)
	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}

		baseName := filepath.Base(f.Name)

		// Determine what to extract
		isBinary := baseName == targetName || baseName == "main.exe" || baseName == "whisper.exe" || baseName == "main" || baseName == "whisper"
		isDLL := strings.HasSuffix(strings.ToLower(baseName), ".dll")
		isSO := strings.HasSuffix(strings.ToLower(baseName), ".so") || strings.Contains(strings.ToLower(baseName), ".so.")
		isDylib := strings.HasSuffix(strings.ToLower(baseName), ".dylib")

		if !isBinary && !isDLL && !isSO && !isDylib {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		// Rename fallback binaries to the target name
		outName := baseName
		if isBinary && baseName != targetName {
			outName = targetName
		}

		outPath := filepath.Join(c.whisperDir, outName)
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

		if isBinary {
			if runtime.GOOS != "windows" {
				os.Chmod(outPath, 0755)
			}
			foundBinary = true
			logger.Log.Info().Str("path", outPath).Msg("whisper-cli extracted")
		} else {
			logger.Log.Info().Str("path", outPath).Msg("dependency extracted")
		}
	}

	if !foundBinary {
		return fmt.Errorf("whisper-cli not found in archive")
	}

	return nil
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
		"model":   modelName,
		"status":  "downloading",
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

// convertToWav converte qualquer arquivo de áudio/vídeo para WAV 16-bit 16kHz mono,
// que é o único formato aceito pelo binário padrão do whisper-cli.
// O arquivo temporário deve ser deletado pelo chamador após o uso.
func (c *Client) convertToWav(inputPath string) (string, error) {
	if c.ffmpegPath == "" {
		return "", fmt.Errorf("ffmpeg não encontrado — necessário para converter áudio para WAV")
	}

	tmpWav := inputPath + "_whisper_tmp.wav"

	args := []string{
		"-y",            // sobrescreve sem perguntar
		"-i", inputPath, // arquivo de entrada
		"-ar", "16000", // taxa de amostragem 16kHz (exigida pelo whisper)
		"-ac", "1", // mono
		"-c:a", "pcm_s16le", // PCM 16-bit little-endian
		tmpWav,
	}

	logger.Log.Info().
		Str("input", inputPath).
		Str("output", tmpWav).
		Msg("converting audio to 16-bit WAV for whisper")

	cmd := exec.CommandContext(c.ctx, c.ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg conversion failed: %w\n%s", err, string(output))
	}

	if info, err := os.Stat(tmpWav); err != nil || info.Size() == 0 {
		return "", fmt.Errorf("ffmpeg não gerou arquivo de saída: %w", err)
	}

	return tmpWav, nil
}

// isWav retorna true se o arquivo já é WAV (whisper aceita WAV diretamente).
func isWav(filePath string) bool {
	return strings.ToLower(filepath.Ext(filePath)) == ".wav"
}

// detectLanguage faz um passe rápido com -dl para identificar o idioma do áudio
// com precisão antes da transcrição. O whisper usa os primeiros 30s para detectar.
// Retorna o código ISO 639-1 (ex: "pt", "en", "es") ou "" se não conseguir detectar.
func (c *Client) detectLanguage(binaryPath, modelPath, wavPath string) string {
	// Timeout curto: detecção de idioma é rápida (processa só 30s do áudio)
	ctx, cancel := context.WithTimeout(c.ctx, 3*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, binaryPath,
		"-m", modelPath,
		"-f", wavPath,
		"-dl", // detect-language: sai após detectar o idioma
	)

	// whisper pode escrever a detecção tanto em stdout quanto em stderr
	output, _ := cmd.CombinedOutput()
	rawOut := string(output)

	logger.Log.Debug().Str("dl-output", rawOut).Msg("language detection output")

	matches := langDetectRe.FindStringSubmatch(rawOut)
	if len(matches) >= 2 {
		detected := strings.ToLower(strings.TrimSpace(matches[1]))
		if validLanguages[detected] {
			logger.Log.Info().Str("detected", detected).Msg("whisper language detected")
			return detected
		}
	}

	logger.Log.Warn().Str("output", rawOut).Msg("could not parse detected language from whisper output")
	return ""
}

// TranscribeFile transcribes an audio/video file using whisper.cpp.
// Arquivos não-WAV são convertidos automaticamente para WAV 16-bit via ffmpeg,
// pois o binário padrão do whisper.cpp só aceita esse formato.
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

	// Validate language code
	if language != "" && language != "auto" {
		if !validLanguages[language] {
			return nil, fmt.Errorf("unsupported language code: %s", language)
		}
	}

	c.emitEvent("whisper:transcribe-progress", map[string]interface{}{
		"status": "converting",
		"file":   filepath.Base(filePath),
	})

	// O binário padrão do whisper.cpp aceita apenas WAV 16-bit 16kHz mono.
	// Converter automaticamente qualquer outro formato via ffmpeg.
	whisperInput := filePath
	if !isWav(filePath) {
		converted, err := c.convertToWav(filePath)
		if err != nil {
			return nil, err
		}
		whisperInput = converted
		defer os.Remove(converted) // limpa arquivo temporário
	}

	// Two-pass language detection:
	// Quando o idioma é "auto", fazemos um passe rápido com -dl para identificar
	// o idioma com precisão, evitando transcrições erradas (ex: PT → EN).
	// O passe de detecção processa apenas os primeiros 30 segundos do áudio.
	effectiveLang := language
	if language == "" || language == "auto" {
		c.emitEvent("whisper:transcribe-progress", map[string]interface{}{
			"status": "detecting-language",
			"file":   filepath.Base(filePath),
		})
		if detected := c.detectLanguage(binaryPath, modelPath, whisperInput); detected != "" {
			effectiveLang = detected
			c.emitEvent("whisper:transcribe-language", map[string]interface{}{
				"language": detected,
			})
			logger.Log.Info().Str("lang", detected).Msg("using auto-detected language for transcription")
		}
		// Se a detecção falhar, o whisper faz auto-detect interno (menos preciso mas funciona)
	}

	c.emitEvent("whisper:transcribe-progress", map[string]interface{}{
		"status": "processing",
		"file":   filepath.Base(filePath),
	})

	// whisper-cli outputs transcription to stdout.
	// -np suprime prints informativos para que o stdout contenha APENAS as
	// linhas de transcrição com timestamps.
	args := []string{
		"-m", modelPath,
		"-f", whisperInput,
		"-np", // no informational prints — cleaner stdout
	}

	if effectiveLang != "" && effectiveLang != "auto" {
		args = append(args, "-l", effectiveLang)
	}

	logger.Log.Info().
		Str("binary", binaryPath).
		Str("original", filePath).
		Str("input", whisperInput).
		Str("lang-requested", language).
		Str("lang-effective", effectiveLang).
		Strs("args", args).
		Msg("running whisper transcription")

	// Create a timeout context for the transcription
	ctx, cancel := context.WithTimeout(c.ctx, transcriptionTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, binaryPath, args...)

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

	// Drain stderr in background to avoid pipe deadlock
	var stderrLines []string
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			stderrLines = append(stderrLines, line)
			logger.Log.Debug().Str("whisper-stderr", line).Msg("")
			c.emitEvent("whisper:transcribe-progress", map[string]interface{}{
				"status": "processing",
				"detail": line,
			})
		}
	}()

	// Read full stdout (transcription output)
	outputBytes, err := io.ReadAll(stdout)
	if err != nil {
		return nil, err
	}

	// Wait for stderr goroutine to finish before cmd.Wait()
	wg.Wait()

	if err := cmd.Wait(); err != nil {
		// Include stderr context in the error message
		errMsg := fmt.Sprintf("whisper exited with error: %v", err)
		if len(stderrLines) > 0 {
			last := stderrLines[len(stderrLines)-1]
			errMsg = fmt.Sprintf("%s — %s", errMsg, last)
		}
		return nil, fmt.Errorf("%s", errMsg)
	}

	rawOutput := strings.TrimSpace(string(outputBytes))
	logger.Log.Debug().
		Str("raw-stdout", rawOutput).
		Int("stderr-lines", len(stderrLines)).
		Msg("whisper output captured")

	// Parse segments from timestamped output
	segments := parseSegments(rawOutput)

	// Calculate duration from the last segment
	var duration float64
	if len(segments) > 0 {
		duration = segments[len(segments)-1].End
	}

	// Build final text based on output format
	var text string
	switch outputFormat {
	case "srt":
		text = formatSRT(segments)
	case "vtt":
		text = formatVTT(segments)
	default:
		// txt or docx: plain spoken words
		text = buildPlainText(segments, rawOutput)
	}

	c.emitEvent("whisper:transcribe-progress", map[string]interface{}{
		"status": "complete",
	})

	return &TranscribeResult{
		Text:     text,
		Segments: segments,
		Language: effectiveLang, // retorna o idioma que realmente foi usado
		Duration: duration,
	}, nil
}

// parseSegments extracts timestamped segments from whisper output.
func parseSegments(output string) []Segment {
	var segments []Segment
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		matches := timestampRe.FindStringSubmatch(line)
		if matches == nil {
			continue
		}
		start := parseTimestamp(matches[1])
		end := parseTimestamp(matches[2])
		text := strings.TrimSpace(matches[3])
		if text == "" {
			continue
		}
		segments = append(segments, Segment{
			Start: start,
			End:   end,
			Text:  text,
		})
	}
	return segments
}

// parseTimestamp converts "HH:MM:SS.mmm" to seconds.
func parseTimestamp(ts string) float64 {
	// HH:MM:SS.mmm
	parts := strings.Split(ts, ":")
	if len(parts) != 3 {
		return 0
	}
	h, _ := strconv.ParseFloat(parts[0], 64)
	m, _ := strconv.ParseFloat(parts[1], 64)
	secParts := strings.Split(parts[2], ".")
	s, _ := strconv.ParseFloat(secParts[0], 64)
	var ms float64
	if len(secParts) > 1 {
		ms, _ = strconv.ParseFloat("0."+secParts[1], 64)
	}
	return h*3600 + m*60 + s + ms
}

// buildPlainText returns clean text from segments, falling back to raw output.
func buildPlainText(segments []Segment, rawOutput string) string {
	if len(segments) == 0 {
		// Fallback: strip any timestamp patterns and return as-is
		return strings.TrimSpace(timestampRe.ReplaceAllString(rawOutput, "$3"))
	}
	var parts []string
	for _, seg := range segments {
		parts = append(parts, seg.Text)
	}
	return strings.TrimSpace(strings.Join(parts, " "))
}

// formatSRT converts segments to SRT subtitle format.
func formatSRT(segments []Segment) string {
	var sb strings.Builder
	for i, seg := range segments {
		fmt.Fprintf(&sb, "%d\n", i+1)
		fmt.Fprintf(&sb, "%s --> %s\n", formatSRTTime(seg.Start), formatSRTTime(seg.End))
		fmt.Fprintf(&sb, "%s\n\n", seg.Text)
	}
	return strings.TrimSpace(sb.String())
}

// formatVTT converts segments to WebVTT subtitle format.
func formatVTT(segments []Segment) string {
	var sb strings.Builder
	sb.WriteString("WEBVTT\n\n")
	for _, seg := range segments {
		fmt.Fprintf(&sb, "%s --> %s\n", formatVTTTime(seg.Start), formatVTTTime(seg.End))
		fmt.Fprintf(&sb, "%s\n\n", seg.Text)
	}
	return strings.TrimSpace(sb.String())
}

// formatSRTTime formats seconds as HH:MM:SS,mmm (SRT uses comma).
func formatSRTTime(seconds float64) string {
	h := int(seconds) / 3600
	m := (int(seconds) % 3600) / 60
	s := int(seconds) % 60
	ms := int((seconds - float64(int(seconds))) * 1000)
	return fmt.Sprintf("%02d:%02d:%02d,%03d", h, m, s, ms)
}

// formatVTTTime formats seconds as HH:MM:SS.mmm (VTT uses dot).
func formatVTTTime(seconds float64) string {
	h := int(seconds) / 3600
	m := (int(seconds) % 3600) / 60
	s := int(seconds) % 60
	ms := int((seconds - float64(int(seconds))) * 1000)
	return fmt.Sprintf("%02d:%02d:%02d.%03d", h, m, s, ms)
}

// emitEvent emits a Wails event.
func (c *Client) emitEvent(eventName string, data interface{}) {
	if app := application.Get(); app != nil {
		app.Event.Emit(eventName, data)
	}
}

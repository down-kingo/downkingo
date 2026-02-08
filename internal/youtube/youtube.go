package youtube

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES DE PERFORMANCE
// Compiladas uma única vez no startup para evitar overhead em loops
// ═══════════════════════════════════════════════════════════════════════════════

const (
	// concurrentFragments controls how many video fragments download in parallel.
	// 4 is a balanced default that works well for most network conditions.
	concurrentFragments = "4"

	// bufferSize for reading yt-dlp output. 16KB provides good throughput.
	bufferSize = "16K"

	// defaultAria2Connections is the number of connections for aria2c multi-thread.
	defaultAria2Connections = 16
)

var (
	// progressRegex captures percentage values from yt-dlp/aria2c output.
	// Pre-compiled for performance (used hundreds of times per download).
	progressRegex = regexp.MustCompile(`(\d+\.?\d*)%`)

	// ansiRegex removes ANSI color codes from terminal output.
	ansiRegex = regexp.MustCompile(`\x1b\[[0-9;]*m`)
)

// sanitizeUTF8 converte bytes incorretos (ex: CP1252/Latin-1) para UTF-8 válido
// Isso corrige o problema de acentos no Windows onde o output do yt-dlp pode vir em CP1252
func sanitizeUTF8(s string) string {
	if utf8.ValidString(s) {
		return s
	}
	// Converter byte a byte assumindo CP1252/Latin-1
	var result []rune
	for i := 0; i < len(s); i++ {
		b := s[i]
		// CP1252 bytes 0x80-0x9F têm mapeamento especial
		// Para simplificar, tratamos como Latin-1 (ISO-8859-1) que é um superset de ASCII
		result = append(result, rune(b))
	}
	return string(result)
}

// ProgressCallback é chamado durante o download com atualizações de progresso
type ProgressCallback func(progress DownloadProgress)

// LogCallback é chamado para cada linha de output do yt-dlp
type LogCallback func(line string)

// Resolution é um tipo customizado que lida com valores null/string do yt-dlp
type Resolution string

// UnmarshalJSON implementa json.Unmarshaler para lidar com null e string
func (r *Resolution) UnmarshalJSON(data []byte) error {
	// Handle null
	if string(data) == "null" {
		*r = ""
		return nil
	}
	// Handle string
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		// Silently ignore invalid types, set empty
		*r = ""
		return nil
	}
	*r = Resolution(s)
	return nil
}

// Quality é um tipo customizado que lida com valores numéricos ou string do yt-dlp
type Quality string

// UnmarshalJSON implementa json.Unmarshaler para lidar com number e string
func (q *Quality) UnmarshalJSON(data []byte) error {
	// Try as string first
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		*q = Quality(s)
		return nil
	}
	// Try as number
	var n float64
	if err := json.Unmarshal(data, &n); err == nil {
		*q = Quality(fmt.Sprintf("%.0f", n))
		return nil
	}
	// Fallback
	*q = ""
	return nil
}

// FlexibleInt é um tipo customizado que lida com valores int OU float64 do JSON
// yt-dlp pode retornar duration como 8.171 (float) ou 8 (int) dependendo do extrator
type FlexibleInt int

// UnmarshalJSON implementa json.Unmarshaler para aceitar int ou float64
func (f *FlexibleInt) UnmarshalJSON(data []byte) error {
	// Handle null
	if string(data) == "null" {
		*f = 0
		return nil
	}
	// Try as int first
	var i int
	if err := json.Unmarshal(data, &i); err == nil {
		*f = FlexibleInt(i)
		return nil
	}
	// Try as float64 (truncate to int)
	var n float64
	if err := json.Unmarshal(data, &n); err == nil {
		*f = FlexibleInt(int(n))
		return nil
	}
	// Fallback
	*f = 0
	return nil
}

// VideoInfo holds metadata about a video
type VideoInfo struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	URL         string      `json:"url"` // Direct URL if available (e.g. images)
	Duration    FlexibleInt `json:"duration"`
	Thumbnail   string      `json:"thumbnail"`
	Uploader    string      `json:"uploader"`
	ViewCount   int64       `json:"view_count"`
	Description string      `json:"description"`
	Width       int         `json:"width"`
	Height      int         `json:"height"`
	Formats     []Format    `json:"formats"`
}

// Format represents an available video format
// Usa tipos customizados para lidar com inconsistências do JSON do yt-dlp
type Format struct {
	FormatID   string     `json:"format_id"`
	URL        string     `json:"url"` // Direct media URL
	Ext        string     `json:"ext"`
	Resolution Resolution `json:"resolution"`
	Filesize   int64      `json:"filesize"`
	VCodec     string     `json:"vcodec"`
	ACodec     string     `json:"acodec"`
	Quality    Quality    `json:"quality"`
	Height     int        `json:"height"`
	Width      int        `json:"width"`
}

// DownloadProgress represents download progress
type DownloadProgress struct {
	Percent  float64 `json:"percent"`
	Speed    string  `json:"speed"`
	ETA      string  `json:"eta"`
	Status   string  `json:"status"` // downloading, merging, complete, error
	Filename string  `json:"filename"`
}

// Client wraps yt-dlp operations
type Client struct {
	ctx        context.Context
	ytDlpPath  string
	ffmpegPath string
	aria2cPath string // Opcional: para downloads multi-thread
	outputDir  string
}

// NewClient creates a new YouTube client
func NewClient(ytDlpPath, ffmpegPath, outputDir string) *Client {
	return &Client{
		ytDlpPath:  ytDlpPath,
		ffmpegPath: ffmpegPath,
		outputDir:  outputDir,
	}
}

// SetContext sets the context for command cancellation
func (c *Client) SetContext(ctx context.Context) {
	c.ctx = ctx
}

// SetOutputDirectory updates the download output directory
func (c *Client) SetOutputDirectory(dir string) {
	c.outputDir = dir
}

// SetAria2Path configura o caminho para aria2c (habilita downloads multi-thread)
func (c *Client) SetAria2Path(path string) {
	// Verificar se o arquivo existe
	if _, err := os.Stat(path); err == nil {
		c.aria2cPath = path
	}
}

// UpdateYtDlp updates the yt-dlp binary
func (c *Client) UpdateYtDlp(channel string) (string, error) {
	// channel: stable, nightly, master, or specific tag
	args := []string{"--update"}

	if channel != "" && channel != "stable" {
		args = append(args, "--update-to", channel)
	}

	cmd := exec.CommandContext(context.Background(), c.ytDlpPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), err
	}
	return string(output), nil
}

// createCommand creates a command with proper context and hidden window (Windows).
// Uses the client's default context. For custom context, use createCommandWithContext.
func (c *Client) createCommand(args []string) *exec.Cmd {
	return c.createCommandWithContext(c.ctx, args)
}

// createCommandWithContext creates a command with a specific context.
// Consolidates all platform-specific configuration and UTF-8 encoding setup.
// This is the single source of truth for command creation - DRY principle.
func (c *Client) createCommandWithContext(ctx context.Context, args []string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, c.ytDlpPath, args...)

	// Platform-specific process attributes (hides console on Windows)
	setSysProcAttr(cmd)

	// Force UTF-8 encoding on yt-dlp output (fixes accents on Windows)
	// This MUST be set on every command to ensure consistent output encoding
	cmd.Env = append(cmd.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
		"LC_ALL=en_US.UTF-8",
	)

	return cmd
}

// GetVideoInfo fetches metadata for a URL (optimized for speed)
func (c *Client) GetVideoInfo(ctx context.Context, url string) (*VideoInfo, error) {
	args := []string{
		"--dump-json",
		"--no-playlist",
		// === PERFORMANCE FLAGS ===
		"--no-check-formats",       // NÃO verifica cada formato (economia de ~2-3s)
		"--no-check-certificate",   // Pula verificação SSL
		"--no-warnings",            // Menos output
		"--extractor-retries", "0", // Não retry em extratores
		"--socket-timeout", "10", // Timeout agressivo (10s)
		"--ignore-errors", // Continua mesmo com erros menores
		// FFmpeg não é necessário para metadata (removido)
		url,
	}

	// Use createCommandWithContext for proper setup (DRY)
	cmd := c.createCommandWithContext(ctx, args)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	if err != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg != "" {
			return nil, fmt.Errorf("yt-dlp error: %s", errMsg)
		}
		return nil, fmt.Errorf("yt-dlp error: %w", err)
	}

	var info VideoInfo
	if err := json.Unmarshal(output, &info); err != nil {
		return nil, fmt.Errorf("failed to parse video info: %w", err)
	}

	return &info, nil
}

// GetVideoInfoWithCookies fetches metadata using browser cookies for authenticated content
// Supports: chrome, firefox, edge, opera, brave, chromium, vivaldi, safari
func (c *Client) GetVideoInfoWithCookies(ctx context.Context, url string, browser string) (*VideoInfo, error) {
	if browser == "" {
		browser = "chrome" // Default mais comum
	}

	args := []string{
		"--dump-json",
		"--no-playlist",
		"--cookies-from-browser", browser, // USA COOKIES DO NAVEGADOR
		// === PERFORMANCE FLAGS ===
		"--no-check-formats",
		"--no-check-certificate",
		"--no-warnings",
		"--extractor-retries", "1", // Permitir 1 retry com cookies
		"--socket-timeout", "15", // Timeout um pouco maior para auth
		"--ignore-errors",
		url,
	}

	// Use createCommandWithContext for proper setup (DRY)
	cmd := c.createCommandWithContext(ctx, args)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	if err != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg != "" {
			return nil, fmt.Errorf("yt-dlp error (with cookies): %s", errMsg)
		}
		return nil, fmt.Errorf("yt-dlp error (with cookies): %w", err)
	}

	var info VideoInfo
	if err := json.Unmarshal(output, &info); err != nil {
		return nil, fmt.Errorf("failed to parse video info: %w", err)
	}

	return &info, nil
}

// GetPlaylistInfo fetches metadata for a playlist URL (or carousel)
func (c *Client) GetPlaylistInfo(ctx context.Context, url string) ([]VideoInfo, error) {
	args := []string{
		"--dump-json",
		// Note: removed --no-playlist
		// === PERFORMANCE FLAGS ===
		"--no-check-formats",
		"--no-check-certificate",
		"--no-warnings",
		"--extractor-retries", "1",
		"--socket-timeout", "15",
		"--ignore-errors",
		url,
	}

	// Use createCommandWithContext for proper setup (DRY)
	cmd := c.createCommandWithContext(ctx, args)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("yt-dlp error: %w", err)
	}

	var results []VideoInfo

	// yt-dlp pode retornar um único objeto JSON (playlist) ou múltiplos objetos JSON (um por linha)
	// Vamos tentar parsear como objeto playlist primeiro
	var playlist struct {
		Type    string      `json:"_type"`
		Entries []VideoInfo `json:"entries"`
	}

	if err := json.Unmarshal(output, &playlist); err == nil && playlist.Type == "playlist" {
		return playlist.Entries, nil
	}

	// Se falhar, tentar ler linha por linha (caso flat-playlist ou comportamento padrão para alguns extratores)
	scanner := bufio.NewScanner(bytes.NewReader(output))
	for scanner.Scan() {
		line := scanner.Bytes()
		var info VideoInfo
		if err := json.Unmarshal(line, &info); err == nil {
			results = append(results, info)
		}
	}

	if len(results) == 0 {
		// Tentar parsear como single video (caso não seja playlist mas retornou sucesso)
		var info VideoInfo
		if err := json.Unmarshal(output, &info); err == nil {
			return []VideoInfo{info}, nil
		}
		return nil, errors.New("falha ao parsear playlist info")
	}

	return results, nil
}

// DownloadOptions specifies download parameters
type DownloadOptions struct {
	URL               string `json:"url"`
	Format            string `json:"format"`            // yt-dlp format selector
	AudioOnly         bool   `json:"audioOnly"`         // Extract audio only
	AudioFormat       string `json:"audioFormat"`       // mp3, m4a, opus, flac, wav
	AudioBitrate      string `json:"audioBitrate"`      // 320, 256, 192, 128, 96
	DownloadSubtitles bool   `json:"downloadSubtitles"` // Download subtitles
	SubtitleLanguage  string `json:"subtitleLanguage"`  // pt-BR, en, es, etc.
	EmbedSubtitles    bool   `json:"embedSubtitles"`    // Embed subs in video

	// New Options
	RemuxVideo        bool   `json:"remuxVideo"`        // Remux to mp4/mkv
	RemuxFormat       string `json:"remuxFormat"`       // mp4, mkv (default mp4)
	EmbedThumbnail    bool   `json:"embedThumbnail"`    // Embed thumb in video file
	SkipExisting      bool   `json:"skipExisting"`      // Skip if file exists
	Incognito         bool   `json:"incognito"`         // Do not save history
	UseAria2c         bool   `json:"useAria2c"`         // Use aria2c for multi-thread download
	Aria2cConnections int    `json:"aria2cConnections"` // Number of connections (default 16)
	Title             string `json:"title"`             // Optional metadata
	Thumbnail         string `json:"thumbnail"`         // Optional metadata
}

// Download downloads a video with progress callbacks
// onProgress e onLog são opcionais - se nil, não são chamados
func (c *Client) Download(ctx context.Context, opts DownloadOptions, onProgress ProgressCallback, onLog LogCallback) error {
	args := []string{
		"--ffmpeg-location", c.ffmpegPath,
		"--newline", // Progress on new lines
		"-o", fmt.Sprintf("%s/%%(title)s.%%(ext)s", c.outputDir),
		"--no-playlist", // Single video only
		// === PERFORMANCE FLAGS ===
		"--no-check-certificate",                      // Skip SSL verification
		"--concurrent-fragments", concurrentFragments, // Download N fragments simultaneously
		"--buffer-size", bufferSize, // Larger buffer for throughput
		"--no-warnings", // Suppress warnings (like mutagen fallbacks)
	}

	// ═══════════════════════════════════════════════════════════════════════
	// ARIA2C: Downloads multi-thread
	// Só usa se: 1) aria2c disponível E 2) usuário ativou nas configurações
	// ═══════════════════════════════════════════════════════════════════════
	if opts.UseAria2c && c.aria2cPath != "" {
		connections := opts.Aria2cConnections
		if connections <= 0 {
			connections = defaultAria2Connections
		}
		aria2Args := fmt.Sprintf("aria2c:-x %d -s %d -k 1M --file-allocation=none", connections, connections)
		args = append(args,
			"--external-downloader", c.aria2cPath,
			"--external-downloader-args", aria2Args,
		)
	}

	// Skip Existing Logic
	if opts.SkipExisting {
		args = append(args, "--no-overwrites")
	} else {
		args = append(args, "--force-overwrites")
	}

	// Embed Thumbnail (Video & Audio)
	if opts.EmbedThumbnail {
		args = append(args, "--embed-thumbnail")
	}

	if opts.AudioOnly {
		// Audio extraction mode
		args = append(args, "-x") // Extract audio

		// Audio format
		audioFormat := opts.AudioFormat
		if audioFormat == "" {
			audioFormat = "mp3"
		}
		args = append(args, "--audio-format", audioFormat)

		// Audio quality/bitrate
		if opts.AudioBitrate != "" {
			// For lossy formats, set bitrate
			if audioFormat == "mp3" || audioFormat == "m4a" || audioFormat == "opus" {
				args = append(args, "--audio-quality", opts.AudioBitrate+"K")
			}
		} else {
			args = append(args, "--audio-quality", "0") // Best quality
		}

	} else {
		// Video mode
		format := opts.Format

		// SMART FORMAT SELECTION
		// Se não for YouTube, forçar 'best' para evitar erros de "requested format not available"
		// Instagram, TikTok, Twitter geralmente não suportam seletores complexos de width/codec
		isYouTube := strings.Contains(opts.URL, "youtube.com") || strings.Contains(opts.URL, "youtu.be")

		if !isYouTube {
			format = "b"
		} else if format == "" || format == "best" {
			// Default complexo apenas para YouTube
			format = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
		}

		args = append(args, "-f", format)

		// Remux Video
		if opts.RemuxVideo {
			remuxFmt := opts.RemuxFormat
			if remuxFmt == "" {
				remuxFmt = "mp4"
			}
			args = append(args, "--remux-video", remuxFmt)
		} else {
			// Legacy merge behavior (only if not remuxing explicitly)
			args = append(args, "--merge-output-format", "mp4")
		}

		// Subtitles
		if opts.DownloadSubtitles {
			args = append(args, "--write-subs", "--write-auto-subs")

			if opts.SubtitleLanguage != "" {
				args = append(args, "--sub-langs", opts.SubtitleLanguage)
			} else {
				args = append(args, "--sub-langs", "pt,pt-BR,en")
			}

			if opts.EmbedSubtitles {
				args = append(args, "--embed-subs")
			}
		}
	}

	args = append(args, opts.URL)

	cmd := exec.CommandContext(ctx, c.ytDlpPath, args...)
	setSysProcAttr(cmd)
	cmd.Env = append(cmd.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
		"PYTHONUNBUFFERED=1", // CRÍTICO: Força o Python a não fazer buffer de saída
		"LC_ALL=en_US.UTF-8",
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}

	// Unificar Stdout e Stderr para capturar logs e progresso de ambos
	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		return err
	}

	// Goroutine de segurança: Garante que o processo morra se o contexto for cancelado.
	// O CommandContext já deveria fazer isso, mas no Windows com subprocessos (aria2c),
	// um kill explícito é mais garantido.
	go func() {
		<-ctx.Done()
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
	}()

	// Parse progress from stdout
	scanner := bufio.NewScanner(stdout)

	// CRÍTICO: Configurar scanner para quebrar em \r E \n
	// Isso resolve o problema de buffer quando o yt-dlp/aria2c usa carriage return
	scanner.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		if i := bytes.IndexAny(data, "\r\n"); i >= 0 {
			// Encontrou quebra (\r ou \n)
			// Se for \r\n, avança 2, senão 1
			if data[i] == '\r' && i+1 < len(data) && data[i+1] == '\n' {
				return i + 2, data[0:i], nil
			}
			return i + 1, data[0:i], nil
		}
		// Se estamos no fim e não tem quebra, retorna o resto
		if atEOF {
			return len(data), data, nil
		}
		// Pede mais dados
		return 0, nil, nil
	})

	// Regex patterns já compilados no nível do pacote para performance

	for scanner.Scan() {
		rawLine := scanner.Text()

		// Limpar cores
		line := ansiRegex.ReplaceAllString(rawLine, "")
		line = strings.TrimSpace(line)
		// Corrigir encoding (CP1252/Latin-1 -> UTF-8) para Windows
		line = sanitizeUTF8(line)

		// Log debugging no console do Wails
		if len(line) > 0 {
			// fmt.Println("YTDLP RAW:", line) // Uncomment for debug
			if onLog != nil {
				onLog(line)
			}
		}

		if len(line) < 3 {
			continue
		}

		// Captura genérica de porcentagem
		if matches := progressRegex.FindStringSubmatch(line); len(matches) >= 2 {
			percent, err := strconv.ParseFloat(matches[1], 64)
			if err == nil {
				// Tentar capturar speed
				speed := ""
				if strings.Contains(line, "/s") {
					parts := strings.Fields(line)
					for _, p := range parts {
						if strings.Contains(p, "/s") { // Ex: 5.2MiB/s
							speed = p
							break
						}
					}
				}

				// Tentar capturar ETA
				eta := ""
				if idx := strings.Index(line, "ETA"); idx != -1 {
					rest := strings.TrimSpace(line[idx+3:]) // Pega tudo depois de ETA
					parts := strings.Fields(rest)
					if len(parts) > 0 {
						// Tentar limpar caracteres comuns em volta do ETA tempo (ex: 00:03)
						cleanEta := strings.Trim(parts[0], "[]()")
						// Validar formato básico de tempo (contém :)
						if strings.Contains(cleanEta, ":") || strings.HasSuffix(cleanEta, "s") || strings.HasSuffix(cleanEta, "m") {
							eta = cleanEta
						}
					}
				}

				if onProgress != nil {
					onProgress(DownloadProgress{
						Percent: percent,
						Speed:   speed,
						ETA:     eta,
						Status:  "downloading",
					})
				}
			}
		} else if strings.Contains(line, "[Merger]") || strings.Contains(line, "Merging") {
			if onProgress != nil {
				onProgress(DownloadProgress{
					Percent: 100,
					Status:  "merging",
				})
			}
		}
	}

	if err := cmd.Wait(); err != nil {
		// Se o contexto foi cancelado, não emitimos erro
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			if onProgress != nil {
				onProgress(DownloadProgress{Status: "failed"}) // 'failed' é o padrão no storage
			}
			return err
		}
	}

	if onProgress != nil {
		onProgress(DownloadProgress{
			Percent: 100,
			Status:  "completed",
		})
	}

	return nil
}

// HasAria2 retorna true se aria2c está configurado e disponível
func (c *Client) HasAria2() bool {
	return c.aria2cPath != ""
}

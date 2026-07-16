package youtube

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	aria2runtime "kingo/internal/aria2"
)

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES DE PERFORMANCE
// Compiladas uma única vez no startup para evitar overhead em loops
// ═══════════════════════════════════════════════════════════════════════════════

const (
	defaultConcurrentFragments = 8
	maxConcurrentFragments     = 16

	// bufferSize for reading yt-dlp output. 16KB provides good throughput.
	bufferSize = "16K"

	// defaultAria2Connections is the number of connections for aria2c multi-thread.
	defaultAria2Connections = 16
)

var (
	// progressRegex captures percentage values from yt-dlp/aria2c output.
	// Pre-compiled for performance (used hundreds of times per download).
	progressRegex      = regexp.MustCompile(`(\d+\.?\d*)%`)
	sizeProgressRegex  = regexp.MustCompile(`(?i)(\d+(?:\.\d+)?)%\s+of\s+(?:~\s*)?(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|KB|MB|GB)`)
	thumbnailSizeRegex = regexp.MustCompile(`(?i)(?:^|[?&])stp=[^&]*?(?:s|p)(\d+)x(\d+)`)

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
	// Pré-aloca buffer para evitar realocações O(n²)
	result := make([]rune, len(s))
	for i := 0; i < len(s); i++ {
		result[i] = rune(s[i])
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
	ID                string             `json:"id"`
	Title             string             `json:"title"`
	URL               string             `json:"url"` // Direct URL if available (e.g. images)
	Duration          FlexibleInt        `json:"duration"`
	Thumbnail         string             `json:"thumbnail"`
	Thumbnails        []Thumbnail        `json:"thumbnails"`
	Uploader          string             `json:"uploader"`
	ViewCount         int64              `json:"view_count"`
	Description       string             `json:"description"`
	Language          string             `json:"language"`
	Width             int                `json:"width"`
	Height            int                `json:"height"`
	Formats           []Format           `json:"formats"`
	SubtitleLanguages []SubtitleLanguage `json:"subtitle_languages"`
	CookieBrowser     string             `json:"cookie_browser,omitempty"`
}

// SubtitleLanguage is a caption language advertised by the extractor. Source
// is either "manual" or "automatic"; a manual track wins when both exist.
type SubtitleLanguage struct {
	Code   string `json:"code"`
	Name   string `json:"name"`
	Source string `json:"source"`
}

// Thumbnail is one image candidate emitted by yt-dlp.
type Thumbnail struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// PreferBestThumbnail replaces yt-dlp's display-oriented thumbnail with the
// highest quality candidate. Instagram frequently selects a 480x640 preview
// even when an uncropped 1440x1920 carousel image is available.
func (v *VideoInfo) PreferBestThumbnail() {
	bestURL := v.Thumbnail
	var bestScore int64 = -1

	for index, thumbnail := range v.Thumbnails {
		if !strings.HasPrefix(thumbnail.URL, "http") {
			continue
		}

		score := int64(thumbnail.Width) * int64(thumbnail.Height)
		if match := thumbnailSizeRegex.FindStringSubmatch(thumbnail.URL); len(match) == 3 {
			width, _ := strconv.ParseInt(match[1], 10, 64)
			height, _ := strconv.ParseInt(match[2], 10, 64)
			score = width * height
		} else if !strings.Contains(thumbnail.URL, "stp=") {
			// Instagram's candidate without an stp resize/crop is the original.
			score += 1 << 60
		}

		// yt-dlp keeps the largest Instagram candidates first. Preserve that
		// order when candidates do not contain dimensions.
		score += int64(len(v.Thumbnails) - index)
		if score > bestScore {
			bestScore = score
			bestURL = thumbnail.URL
		}
	}

	if bestURL != "" {
		v.Thumbnail = bestURL
	}
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

func parseProgressBytes(line string) (float64, float64, bool) {
	match := sizeProgressRegex.FindStringSubmatch(line)
	if len(match) != 4 {
		return 0, 0, false
	}
	percent, errPercent := strconv.ParseFloat(match[1], 64)
	size, errSize := strconv.ParseFloat(match[2], 64)
	if errPercent != nil || errSize != nil {
		return 0, 0, false
	}
	multiplier := float64(1)
	switch strings.ToLower(match[3]) {
	case "kib":
		multiplier = 1024
	case "mib":
		multiplier = 1024 * 1024
	case "gib":
		multiplier = 1024 * 1024 * 1024
	case "kb":
		multiplier = 1000
	case "mb":
		multiplier = 1000 * 1000
	case "gb":
		multiplier = 1000 * 1000 * 1000
	}
	total := size * multiplier
	return total * percent / 100, total, true
}

func formatAverageSpeed(bytesPerSecond float64) string {
	if bytesPerSecond >= 1024*1024*1024 {
		return fmt.Sprintf("%.2f GiB/s avg", bytesPerSecond/(1024*1024*1024))
	}
	if bytesPerSecond >= 1024*1024 {
		return fmt.Sprintf("%.2f MiB/s avg", bytesPerSecond/(1024*1024))
	}
	if bytesPerSecond >= 1024 {
		return fmt.Sprintf("%.1f KiB/s avg", bytesPerSecond/1024)
	}
	return fmt.Sprintf("%.0f B/s avg", bytesPerSecond)
}

// Client wraps yt-dlp operations
type Client struct {
	ctx                 context.Context
	ytDlpPath           string
	ffmpegPath          string
	aria2cPath          string // Opcional: para downloads multi-thread
	outputDir           string
	subtitleTranscriber SubtitleTranscriber
	optionsProvider     OptionsProvider
	authBrowsers        sync.Map
}

// OptionsProvider supplies managed yt-dlp arguments for a URL. The PO sidecar
// implements this interface without coupling the downloader to its runtime.
type OptionsProvider interface {
	YtDlpArgs(ctx context.Context, rawURL string, authenticated bool) ([]string, error)
}

var supportedCookieBrowsers = map[string]struct{}{
	"brave": {}, "chrome": {}, "chromium": {}, "edge": {},
	"firefox": {}, "opera": {}, "safari": {}, "vivaldi": {}, "whale": {},
}

// NormalizeCookieBrowser validates browser names before they are forwarded to
// yt-dlp. Keeping this allowlist here prevents arbitrary command arguments from
// reaching the subprocess through the frontend binding.
func NormalizeCookieBrowser(browser string) (string, error) {
	browser = strings.ToLower(strings.TrimSpace(browser))
	if _, ok := supportedCookieBrowsers[browser]; !ok {
		return "", fmt.Errorf("unsupported cookie browser: %q", browser)
	}
	return browser, nil
}

// IsAuthenticationRequired reports the YouTube/session errors for which
// yt-dlp explicitly recommends browser cookies. It deliberately avoids broad
// matches such as just "login" so unrelated extractor errors are not masked.
func IsAuthenticationRequired(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "sign in to confirm you’re not a bot") ||
		strings.Contains(message, "sign in to confirm you're not a bot") ||
		strings.Contains(message, "use --cookies-from-browser") ||
		strings.Contains(message, "authentication required") ||
		strings.Contains(message, "private video")
}

func (c *Client) rememberAuthBrowser(url, browser string) {
	if strings.TrimSpace(url) != "" && browser != "" {
		c.authBrowsers.Store(url, browser)
	}
}

func (c *Client) authBrowserForURL(url string) string {
	if browser, ok := c.authBrowsers.Load(url); ok {
		return browser.(string)
	}
	return ""
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

// SetOptionsProvider installs the single source of managed yt-dlp options.
func (c *Client) SetOptionsProvider(provider OptionsProvider) {
	c.optionsProvider = provider
}

// SetOutputDirectory updates the download output directory
func (c *Client) SetOutputDirectory(dir string) {
	c.outputDir = dir
}

// SetAria2Path configura o caminho para aria2c (habilita downloads multi-thread)
func (c *Client) SetAria2Path(path string) {
	c.aria2cPath = ""
	if _, err := aria2runtime.Validate(path); err == nil {
		c.aria2cPath = path
	}
}

// SetSubtitleTranscriber installs the optional local-speech fallback used when
// a remote video has no manual or automatic subtitle track.
func (c *Client) SetSubtitleTranscriber(transcriber SubtitleTranscriber) {
	c.subtitleTranscriber = transcriber
}

// UpdateYtDlp updates the yt-dlp binary
func (c *Client) UpdateYtDlp(channel string) (string, error) {
	// channel: stable, nightly, master, or specific tag
	args := []string{"--update"}

	if channel != "" && channel != "stable" {
		args = append(args, "--update-to", channel)
	}

	cmd := exec.CommandContext(context.Background(), c.ytDlpPath, args...)
	setSysProcAttr(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), err
	}
	return string(output), nil
}

// createCommandWithContext creates a command with a specific context.
// Consolidates all platform-specific configuration and UTF-8 encoding setup.
// This is the single source of truth for command creation - DRY principle.
func (c *Client) createCommandWithContext(ctx context.Context, args []string) (*exec.Cmd, error) {
	managedArgs := []string{"--js-runtimes", "bun"}
	if c.optionsProvider != nil {
		providerArgs, err := c.optionsProvider.YtDlpArgs(ctx, commandURL(args), hasCommandArg(args, "--cookies-from-browser"))
		if err != nil {
			return nil, err
		}
		managedArgs = append(providerArgs, managedArgs...)
	}
	args = append(managedArgs, args...)
	cmd := exec.CommandContext(ctx, c.ytDlpPath, args...)

	// Platform-specific process attributes (hides console on Windows)
	setSysProcAttr(cmd)

	// Force UTF-8 encoding on yt-dlp output (fixes accents on Windows)
	// This MUST be set on every command to ensure consistent output encoding
	cmd.Env = append(cmd.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
		"PYTHONUNBUFFERED=1",
		"LC_ALL=en_US.UTF-8",
	)

	return cmd, nil
}

func commandURL(args []string) string {
	for i := len(args) - 1; i >= 0; i-- {
		candidate := strings.TrimSpace(args[i])
		if strings.HasPrefix(candidate, "https://") || strings.HasPrefix(candidate, "http://") {
			return candidate
		}
	}
	return ""
}

func hasCommandArg(args []string, expected string) bool {
	for _, arg := range args {
		if arg == expected {
			return true
		}
	}
	return false
}

// GetVideoInfo fetches metadata for a URL (optimized for speed)
func (c *Client) GetVideoInfo(ctx context.Context, url string) (*VideoInfo, error) {
	args := []string{
		"--dump-json",
		"--no-playlist",
		// === PERFORMANCE FLAGS ===
		"--no-check-formats",       // NÃO verifica cada formato (economia de ~2-3s)
		"--no-warnings",            // Menos output
		"--extractor-retries", "0", // Não retry em extratores
		"--socket-timeout", "10", // Timeout de 10s
		"--ignore-errors", // Continua mesmo com erros menores
		url,
	}

	// Use createCommandWithContext for proper setup (DRY)
	cmd, err := c.createCommandWithContext(ctx, args)
	if err != nil {
		return nil, err
	}
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
	info.PreferBestThumbnail()

	return &info, nil
}

// GetVideoInfoWithCookies fetches metadata using browser cookies for authenticated content
// Supports: chrome, firefox, edge, opera, brave, chromium, vivaldi, safari
func (c *Client) GetVideoInfoWithCookies(ctx context.Context, url string, browser string) (*VideoInfo, error) {
	var err error
	browser, err = NormalizeCookieBrowser(browser)
	if err != nil {
		return nil, err
	}

	args := []string{
		"--dump-json",
		"--no-playlist",
		"--cookies-from-browser", browser, // USA COOKIES DO NAVEGADOR
		// === PERFORMANCE FLAGS ===
		"--no-check-formats",
		"--no-warnings",
		"--extractor-retries", "1", // Permitir 1 retry com cookies
		"--socket-timeout", "15", // Timeout um pouco maior para auth
		"--ignore-errors",
		url,
	}

	// Use createCommandWithContext for proper setup (DRY)
	cmd, err := c.createCommandWithContext(ctx, args)
	if err != nil {
		return nil, err
	}
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
	info.PreferBestThumbnail()
	info.CookieBrowser = browser
	c.rememberAuthBrowser(url, browser)

	return &info, nil
}

// GetPlaylistInfo fetches metadata for a playlist URL (or carousel)
func (c *Client) GetPlaylistInfo(ctx context.Context, url string) ([]VideoInfo, error) {
	args := []string{
		"--dump-json",
		// Instagram carousels may contain images only. yt-dlp exposes those
		// entries through their thumbnails, but normally rejects them for not
		// having video formats before emitting JSON.
		"--ignore-no-formats-error",
		// Note: removed --no-playlist
		// === PERFORMANCE FLAGS ===
		"--no-check-formats",
		"--no-warnings",
		"--extractor-retries", "1",
		"--socket-timeout", "15",
		"--ignore-errors",
		url,
	}

	// Use createCommandWithContext for proper setup (DRY)
	cmd, err := c.createCommandWithContext(ctx, args)
	if err != nil {
		return nil, err
	}
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
		for index := range playlist.Entries {
			playlist.Entries[index].PreferBestThumbnail()
		}
		return playlist.Entries, nil
	}

	// Se falhar, tentar ler linha por linha (caso flat-playlist ou comportamento padrão para alguns extratores)
	scanner := bufio.NewScanner(bytes.NewReader(output))
	for scanner.Scan() {
		line := scanner.Bytes()
		var info VideoInfo
		if err := json.Unmarshal(line, &info); err == nil {
			info.PreferBestThumbnail()
			results = append(results, info)
		}
	}

	if len(results) == 0 {
		// Tentar parsear como single video (caso não seja playlist mas retornou sucesso)
		var info VideoInfo
		if err := json.Unmarshal(output, &info); err == nil {
			info.PreferBestThumbnail()
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
	RemuxVideo          bool   `json:"remuxVideo"`          // Remux to mp4/mkv
	RemuxFormat         string `json:"remuxFormat"`         // mp4, mkv (default mp4)
	EmbedThumbnail      bool   `json:"embedThumbnail"`      // Embed thumb in video file
	SkipExisting        bool   `json:"skipExisting"`        // Skip if file exists
	Incognito           bool   `json:"incognito"`           // Do not save history
	UseAria2c           bool   `json:"useAria2c"`           // Use aria2c for multi-thread download
	Aria2cConnections   int    `json:"aria2cConnections"`   // Number of connections (default 16)
	ConcurrentFragments int    `json:"concurrentFragments"` // Parallel DASH/HLS fragments (default 8)
	Title               string `json:"title"`               // Optional metadata
	Thumbnail           string `json:"thumbnail"`           // Optional metadata
	CookieBrowser       string `json:"cookieBrowser"`       // Browser session explicitly authorized by the user

	// Trimmer: cortar trecho do vídeo
	StartTime string `json:"startTime"` // HH:MM:SS or MM:SS (início do corte)
	EndTime   string `json:"endTime"`   // HH:MM:SS or MM:SS (fim do corte)

	// Edit decision list: source ranges that must be removed and ripple-joined.
	ExcludedRanges []CutRange `json:"excludedRanges"`

	// Captions are visually burned into the rendered video. This is separate
	// from EmbedSubtitles, which only adds a selectable subtitle stream.
	Captions CaptionOptions `json:"captions"`
}

type CutRange struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

// CaptionOptions controls subtitle acquisition and visual rendering.
type CaptionOptions struct {
	Enabled  bool          `json:"enabled"`
	Source   string        `json:"source"` // auto, youtube, whisper
	Language string        `json:"language"`
	Model    string        `json:"model"`
	Cues     []SubtitleCue `json:"cues"`
	Style    SubtitleStyle `json:"style"`
}

// SubtitleCue is one editable, timestamped caption in source-video time.
type SubtitleCue struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Text  string  `json:"text"`
}

// SubtitleStyle maps the editor controls to an ASS style rendered by FFmpeg.
type SubtitleStyle struct {
	FontFamily        string  `json:"fontFamily"`
	FontSize          int     `json:"fontSize"`
	TextColor         string  `json:"textColor"`
	BackgroundColor   string  `json:"backgroundColor"`
	BackgroundOpacity float64 `json:"backgroundOpacity"`
	OutlineColor      string  `json:"outlineColor"`
	OutlineWidth      int     `json:"outlineWidth"`
	Position          string  `json:"position"` // top, center, bottom
	Bold              bool    `json:"bold"`
	Italic            bool    `json:"italic"`
}

// SubtitleResult is returned to the editor after importing a remote track.
type SubtitleResult struct {
	Cues     []SubtitleCue `json:"cues"`
	Language string        `json:"language"`
	Source   string        `json:"source"`
}

// Download downloads a video with progress callbacks
// onProgress e onLog são opcionais - se nil, não são chamados
func (c *Client) Download(ctx context.Context, opts DownloadOptions, onProgress ProgressCallback, onLog LogCallback) error {
	cutRanges := normalizeCutRanges(opts.ExcludedRanges)
	opts.Captions = validCaptionOptions(opts.Captions)
	if opts.Captions.Enabled && opts.AudioOnly {
		return errors.New("legendas visuais só podem ser aplicadas a downloads de vídeo")
	}
	needsRender := len(cutRanges) > 0 || opts.Captions.Enabled
	outputTemplate := fmt.Sprintf("%s/%%(title)s.%%(ext)s", c.outputDir)
	var editTempDir string
	if needsRender {
		var err error
		editTempDir, err = os.MkdirTemp(c.outputDir, ".downkingo-edit-")
		if err != nil {
			return fmt.Errorf("create edit workspace: %w", err)
		}
		defer os.RemoveAll(editTempDir)
		outputTemplate = filepath.Join(editTempDir, "%(title)s.%(ext)s")
	}

	fragments := opts.ConcurrentFragments
	if fragments <= 0 || fragments > maxConcurrentFragments {
		fragments = defaultConcurrentFragments
	}
	args := []string{
		"--ffmpeg-location", c.ffmpegPath,
		"--newline", // Progress on new lines
		"-o", outputTemplate,
		"--no-playlist", // Single video only
		// === PERFORMANCE FLAGS ===
		"--concurrent-fragments", strconv.Itoa(fragments), // Download DASH/HLS fragments simultaneously
		"--buffer-size", bufferSize, // Larger buffer for throughput
		"--throttled-rate", "1M", // Re-extract media URLs when transfer is throttled
	}

	// ═══════════════════════════════════════════════════════════════════════
	// ARIA2C: Downloads multi-thread
	// Só usa se: 1) aria2c disponível E 2) usuário ativou nas configurações
	// ═══════════════════════════════════════════════════════════════════════
	if opts.UseAria2c {
		if c.aria2cPath == "" {
			return fmt.Errorf("aria2c turbo mode is enabled, but the verified runtime is not installed")
		}
		if _, err := aria2runtime.Validate(c.aria2cPath); err != nil {
			return fmt.Errorf("aria2c turbo mode is unavailable: %w", err)
		}
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

		// Subtitle sidecars are also downloaded when visual captions are enabled
		// and the editor did not already provide revised cues.
		needsSourceSubtitles := opts.DownloadSubtitles ||
			(opts.Captions.Enabled && opts.Captions.Source != "whisper" && len(opts.Captions.Cues) == 0)
		if needsSourceSubtitles {
			args = append(args, "--write-subs", "--write-auto-subs")

			subtitleLanguage := opts.SubtitleLanguage
			if opts.Captions.Enabled && opts.Captions.Language != "" && opts.Captions.Language != "auto" {
				subtitleLanguage = opts.Captions.Language
			}
			if subtitleLanguage != "" {
				args = append(args, "--sub-langs", subtitleLanguage)
			} else {
				args = append(args, "--sub-langs", "pt,pt-BR,en")
			}
			args = append(args, "--sub-format", "srt/vtt/best", "--convert-subs", "srt")

			if opts.EmbedSubtitles && !opts.Captions.Enabled {
				args = append(args, "--embed-subs")
			}
		}
	}

	// Trimmer: cortar trecho do vídeo usando --download-sections
	if len(cutRanges) == 0 && opts.StartTime != "" && opts.EndTime != "" {
		section := fmt.Sprintf("*%s-%s", opts.StartTime, opts.EndTime)
		args = append(args, "--download-sections", section, "--force-keyframes-at-cuts")
	}

	if opts.CookieBrowser != "" {
		browser, err := NormalizeCookieBrowser(opts.CookieBrowser)
		if err != nil {
			return err
		}
		args = append(args, "--cookies-from-browser", browser)
		c.rememberAuthBrowser(opts.URL, browser)
	}

	args = append(args, opts.URL)

	cmd, err := c.createCommandWithContext(ctx, args)
	if err != nil {
		return err
	}

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
	processDone := make(chan struct{})
	defer close(processDone)
	go func() {
		select {
		case <-ctx.Done():
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
		case <-processDone:
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
	var transferStarted time.Time
	var transferStartBytes float64
	var lastDownloadedBytes float64

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
		if strings.Contains(line, "[download] Destination:") {
			transferStarted = time.Now()
			transferStartBytes = 0
			lastDownloadedBytes = 0
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

				if downloadedBytes, _, ok := parseProgressBytes(line); ok {
					if transferStarted.IsZero() || (lastDownloadedBytes > 0 && downloadedBytes < lastDownloadedBytes) {
						transferStarted = time.Now()
						transferStartBytes = downloadedBytes
					} else if elapsed := time.Since(transferStarted).Seconds(); elapsed >= 0.25 {
						speed = formatAverageSpeed((downloadedBytes - transferStartBytes) / elapsed)
					}
					lastDownloadedBytes = downloadedBytes
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

	if needsRender {
		if onProgress != nil {
			onProgress(DownloadProgress{Percent: 100, Status: "merging"})
		}
		if onLog != nil && len(cutRanges) > 0 {
			onLog("[Editor] Aplicando cortes e unindo os trechos restantes...")
		}
		if onLog != nil && opts.Captions.Enabled {
			onLog("[Legendas] Preparando a faixa visual e o estilo do editor...")
		}
		if err := c.renderEditedMedia(ctx, editTempDir, cutRanges, opts, onLog); err != nil {
			if onProgress != nil {
				onProgress(DownloadProgress{Status: "failed"})
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

func normalizeCutRanges(ranges []CutRange) []CutRange {
	normalized := make([]CutRange, 0, len(ranges))
	for _, item := range ranges {
		if math.IsNaN(item.Start) || math.IsNaN(item.End) || math.IsInf(item.Start, 0) || math.IsInf(item.End, 0) {
			continue
		}
		item.Start = math.Max(0, item.Start)
		if item.End-item.Start >= 0.1 {
			normalized = append(normalized, item)
		}
	}
	sort.Slice(normalized, func(i, j int) bool { return normalized[i].Start < normalized[j].Start })

	merged := make([]CutRange, 0, len(normalized))
	for _, item := range normalized {
		if len(merged) > 0 && item.Start <= merged[len(merged)-1].End+0.05 {
			merged[len(merged)-1].End = math.Max(merged[len(merged)-1].End, item.End)
			continue
		}
		merged = append(merged, item)
		if len(merged) >= 100 {
			break
		}
	}
	return merged
}

func keptRanges(cuts []CutRange, duration float64) []CutRange {
	kept := make([]CutRange, 0, len(cuts)+1)
	cursor := 0.0
	for _, cut := range cuts {
		start := math.Min(duration, math.Max(cursor, cut.Start))
		end := math.Min(duration, math.Max(start, cut.End))
		if start-cursor >= 0.05 {
			kept = append(kept, CutRange{Start: cursor, End: start})
		}
		cursor = math.Max(cursor, end)
	}
	if duration-cursor >= 0.05 {
		kept = append(kept, CutRange{Start: cursor, End: duration})
	}
	return kept
}

func findDownloadedMedia(root string) (string, error) {
	mediaExtensions := map[string]bool{
		".mp4": true, ".mkv": true, ".webm": true, ".mov": true,
		".mp3": true, ".m4a": true, ".opus": true, ".flac": true, ".wav": true, ".ogg": true,
	}
	var selected string
	var selectedSize int64
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info == nil || info.IsDir() || !mediaExtensions[strings.ToLower(filepath.Ext(path))] {
			return err
		}
		if selected == "" || info.Size() > selectedSize {
			selected = path
			selectedSize = info.Size()
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if selected == "" {
		return "", errors.New("downloaded media was not found in the edit workspace")
	}
	return selected, nil
}

func (c *Client) probeMedia(ctx context.Context, inputPath string) (float64, bool, error) {
	probeName := "ffprobe"
	if strings.EqualFold(filepath.Ext(c.ffmpegPath), ".exe") {
		probeName += ".exe"
	}
	probePath := filepath.Join(filepath.Dir(c.ffmpegPath), probeName)
	if _, err := os.Stat(probePath); err != nil {
		probePath = probeName
	}

	cmd := exec.CommandContext(ctx, probePath,
		"-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", inputPath,
	)
	setSysProcAttr(cmd)
	output, err := cmd.Output()
	if err != nil {
		return 0, false, fmt.Errorf("ffprobe edit input: %w", err)
	}
	var result struct {
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
		Streams []struct {
			CodecType string `json:"codec_type"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
		return 0, false, fmt.Errorf("parse ffprobe output: %w", err)
	}
	duration, err := strconv.ParseFloat(result.Format.Duration, 64)
	if err != nil || duration <= 0 {
		return 0, false, errors.New("invalid media duration for timeline editing")
	}
	hasAudio := false
	for _, stream := range result.Streams {
		if stream.CodecType == "audio" {
			hasAudio = true
			break
		}
	}
	return duration, hasAudio, nil
}

func buildTimelineFilter(segments []CutRange, audioOnly, hasAudio bool) string {
	parts := make([]string, 0, len(segments)*2+1)
	inputs := strings.Builder{}
	for index, segment := range segments {
		start := strconv.FormatFloat(segment.Start, 'f', 6, 64)
		end := strconv.FormatFloat(segment.End, 'f', 6, 64)
		if !audioOnly {
			label := fmt.Sprintf("v%d", index)
			if len(segments) == 1 {
				label = "vout"
			}
			parts = append(parts, fmt.Sprintf("[0:v:0]trim=start=%s:end=%s,setpts=PTS-STARTPTS[%s]", start, end, label))
			if len(segments) > 1 {
				inputs.WriteString("[v" + strconv.Itoa(index) + "]")
			}
		}
		if audioOnly || hasAudio {
			label := fmt.Sprintf("a%d", index)
			if len(segments) == 1 {
				label = "aout"
			}
			parts = append(parts, fmt.Sprintf("[0:a:0]atrim=start=%s:end=%s,asetpts=PTS-STARTPTS[%s]", start, end, label))
			if len(segments) > 1 {
				inputs.WriteString("[a" + strconv.Itoa(index) + "]")
			}
		}
	}
	if len(segments) > 1 {
		videoStreams := 0
		audioStreams := 0
		if !audioOnly {
			videoStreams = 1
		}
		if audioOnly || hasAudio {
			audioStreams = 1
		}
		parts = append(parts, fmt.Sprintf("%sconcat=n=%d:v=%d:a=%d%s", inputs.String(), len(segments), videoStreams, audioStreams, func() string {
			if audioOnly {
				return "[aout]"
			}
			if hasAudio {
				return "[vout][aout]"
			}
			return "[vout]"
		}()))
	}
	return strings.Join(parts, ";")
}

func (c *Client) renderTimelineCuts(ctx context.Context, workspace string, cuts []CutRange, opts DownloadOptions) error {
	return c.renderEditedMedia(ctx, workspace, cuts, opts, nil)
}

func (c *Client) renderEditedMedia(
	ctx context.Context,
	workspace string,
	cuts []CutRange,
	opts DownloadOptions,
	onLog LogCallback,
) error {
	inputPath, err := findDownloadedMedia(workspace)
	if err != nil {
		return fmt.Errorf("prepare timeline edit: %w", err)
	}
	extension := outputExtension(opts)
	outputPath := filepath.Join(c.outputDir, strings.TrimSuffix(filepath.Base(inputPath), filepath.Ext(inputPath))+extension)
	if opts.SkipExisting {
		if _, err := os.Stat(outputPath); err == nil {
			return nil
		}
	}

	duration, hasAudio, err := c.probeMedia(ctx, inputPath)
	if err != nil {
		return err
	}
	segments := keptRanges(cuts, duration)
	if len(segments) == 0 {
		return errors.New("the cuts remove the entire media")
	}
	if opts.AudioOnly && !hasAudio {
		return errors.New("downloaded media has no audio stream to edit")
	}

	filter := buildTimelineFilter(segments, opts.AudioOnly, hasAudio)
	videoOutputLabel := "vout"
	if opts.Captions.Enabled {
		cues, err := c.resolveCaptionCues(ctx, workspace, inputPath, opts.Captions, onLog)
		if err != nil {
			return err
		}
		cues = rippleSubtitleCues(cues, segments)
		if len(cues) == 0 {
			if onLog != nil {
				onLog("[Legendas] Nenhuma fala legendada permaneceu após os cortes.")
			}
		} else {
			assPath, err := writeASSFile(workspace, cues, opts.Captions.Style)
			if err != nil {
				return fmt.Errorf("prepare styled subtitles: %w", err)
			}
			filter = appendASSFilter(filter, "vout", "vfinal", assPath)
			videoOutputLabel = "vfinal"
		}
	}

	args := []string{"-hide_banner", "-loglevel", "error"}
	if opts.SkipExisting {
		args = append(args, "-n")
	} else {
		args = append(args, "-y")
	}
	args = append(args, "-i", inputPath, "-filter_complex", filter)
	if opts.AudioOnly {
		args = append(args, "-map", "[aout]")
	} else {
		args = append(args, "-map", "["+videoOutputLabel+"]")
		if hasAudio {
			args = append(args, "-map", "[aout]", "-c:a", "aac", "-b:a", "192k")
		}
		args = append(args, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-map_metadata", "0")
		if extension == ".mp4" {
			args = append(args, "-movflags", "+faststart")
		}
	}
	args = append(args, outputPath)

	cmd := exec.CommandContext(ctx, c.ffmpegPath, args...)
	setSysProcAttr(cmd)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("ffmpeg timeline edit: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

// HasAria2 retorna true se aria2c está configurado e disponível
func (c *Client) HasAria2() bool {
	return c.aria2cPath != ""
}

// GetStreamURL extracts the direct stream URL using yt-dlp --get-url
// Used by the frontend video trimmer to preview the video before download
func (c *Client) GetStreamURL(ctx context.Context, url string, format string) (string, error) {
	if format == "" {
		format = "best[ext=mp4]/best"
	}

	args := []string{
		"--get-url",
		"-f", format,
		"--no-playlist",
		"--no-warnings",
		"--socket-timeout", "10",
	}
	if browser := c.authBrowserForURL(url); browser != "" {
		args = append(args, "--cookies-from-browser", browser)
	}
	args = append(args, url)

	cmd, err := c.createCommandWithContext(ctx, args)
	if err != nil {
		return "", err
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	if err != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg != "" {
			return "", fmt.Errorf("yt-dlp get-url error: %s", errMsg)
		}
		return "", fmt.Errorf("yt-dlp get-url error: %w", err)
	}

	streamURL := strings.TrimSpace(string(output))
	// yt-dlp may return multiple URLs (video+audio), take the first one
	if lines := strings.Split(streamURL, "\n"); len(lines) > 0 {
		streamURL = strings.TrimSpace(lines[0])
	}

	if streamURL == "" {
		return "", fmt.Errorf("no stream URL returned")
	}

	return streamURL, nil
}

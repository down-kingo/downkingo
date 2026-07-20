package whisper

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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

// TranscribeResult holds the canonical result of a transcription.
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

// ModelInfo holds metadata about an installed Whisper model.
type ModelInfo struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	Path string `json:"path"`
}

// AvailableModel describes a model from the supported, checksummed catalog.
type AvailableModel struct {
	Name        string `json:"name"`
	Size        string `json:"size"`
	Description string `json:"description"`
}

// Client manages the versioned whisper.cpp runtime and its models.
type Client struct {
	ctx         context.Context
	whisperDir  string
	runtimesDir string
	modelsDir   string
	ffmpegPath  string
}

func NewClient(whisperDir, ffmpegPath string) *Client {
	return &Client{
		ctx:         context.Background(),
		whisperDir:  whisperDir,
		runtimesDir: filepath.Join(whisperDir, "runtimes"),
		modelsDir:   filepath.Join(whisperDir, "models"),
		ffmpegPath:  ffmpegPath,
	}
}

func (c *Client) SetContext(ctx context.Context) {
	if ctx == nil {
		ctx = context.Background()
	}
	c.ctx = ctx
}

func (c *Client) baseContext() context.Context {
	if c.ctx != nil {
		return c.ctx
	}
	return context.Background()
}

func (c *Client) EnsureDirectories() error {
	for _, dir := range []string{c.whisperDir, c.runtimesDir, c.modelsDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

func buildPlainText(segments []Segment) string {
	parts := make([]string, 0, len(segments))
	for _, segment := range segments {
		if text := strings.TrimSpace(segment.Text); text != "" {
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, " ")
}

func formatSRT(segments []Segment) string {
	var sb strings.Builder
	for i, segment := range segments {
		fmt.Fprintf(&sb, "%d\n%s --> %s\n%s\n\n", i+1, formatSRTTime(segment.Start), formatSRTTime(segment.End), segment.Text)
	}
	return strings.TrimSpace(sb.String())
}

func formatVTT(segments []Segment) string {
	var sb strings.Builder
	sb.WriteString("WEBVTT\n\n")
	for _, segment := range segments {
		fmt.Fprintf(&sb, "%s --> %s\n%s\n\n", formatVTTTime(segment.Start), formatVTTTime(segment.End), segment.Text)
	}
	return strings.TrimSpace(sb.String())
}

func milliseconds(seconds float64) int64 {
	return int64(seconds*1000 + 0.5)
}

func formatSRTTime(seconds float64) string {
	ms := milliseconds(seconds)
	return fmt.Sprintf("%02d:%02d:%02d,%03d", ms/3600000, (ms%3600000)/60000, (ms%60000)/1000, ms%1000)
}

func formatVTTTime(seconds float64) string {
	return strings.Replace(formatSRTTime(seconds), ",", ".", 1)
}

func (c *Client) emitEvent(eventName string, data interface{}) {
	if app := application.Get(); app != nil {
		app.Event.Emit(eventName, data)
	}
}

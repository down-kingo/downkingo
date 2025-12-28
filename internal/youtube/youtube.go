package youtube

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"kinematic/internal/events"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

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

// VideoInfo holds metadata about a video
type VideoInfo struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Duration    int      `json:"duration"`
	Thumbnail   string   `json:"thumbnail"`
	Uploader    string   `json:"uploader"`
	ViewCount   int64    `json:"view_count"`
	Description string   `json:"description"`
	Formats     []Format `json:"formats"`
}

// Format represents an available video format
// Usa tipos customizados para lidar com inconsistências do JSON do yt-dlp
type Format struct {
	FormatID   string     `json:"format_id"`
	Ext        string     `json:"ext"`
	Resolution Resolution `json:"resolution"`
	Filesize   int64      `json:"filesize"`
	VCodec     string     `json:"vcodec"`
	ACodec     string     `json:"acodec"`
	Quality    Quality    `json:"quality"`
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

// SetContext sets the Wails runtime context
func (c *Client) SetContext(ctx context.Context) {
	c.ctx = ctx
}

// createCommand creates a command with proper context and hidden window (Windows)
func (c *Client) createCommand(args []string) *exec.Cmd {
	// Use CommandContext to kill zombie processes when app closes
	cmd := exec.CommandContext(c.ctx, c.ytDlpPath, args...)

	// Platform-specific process attributes (hides console on Windows)
	setSysProcAttr(cmd)

	return cmd
}

// GetVideoInfo fetches metadata for a URL
func (c *Client) GetVideoInfo(url string) (*VideoInfo, error) {
	args := []string{
		"--dump-json",
		"--no-playlist",
		"--ffmpeg-location", c.ffmpegPath,
		url,
	}

	cmd := c.createCommand(args)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("yt-dlp error: %w", err)
	}

	var info VideoInfo
	if err := json.Unmarshal(output, &info); err != nil {
		return nil, fmt.Errorf("failed to parse video info: %w", err)
	}

	return &info, nil
}

// DownloadOptions specifies download parameters
type DownloadOptions struct {
	URL       string `json:"url"`
	Format    string `json:"format"` // best, bestvideo+bestaudio, mp3, etc.
	AudioOnly bool   `json:"audioOnly"`
}

// Download downloads a video with progress events
func (c *Client) Download(opts DownloadOptions) error {
	args := []string{
		"--ffmpeg-location", c.ffmpegPath,
		"--newline", // Progress on new lines
		"-o", fmt.Sprintf("%s/%%(title)s.%%(ext)s", c.outputDir),
	}

	if opts.AudioOnly {
		args = append(args, "-x", "--audio-format", "mp3", "--audio-quality", "0")
	} else {
		format := opts.Format
		if format == "" || format == "best" {
			format = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
		}
		args = append(args, "-f", format, "--merge-output-format", "mp4")
	}

	args = append(args, opts.URL)

	cmd := c.createCommand(args)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	// Parse progress from stdout
	scanner := bufio.NewScanner(stdout)
	progressRegex := regexp.MustCompile(`\[download\]\s+(\d+\.?\d*)%\s+of.*?at\s+(\S+)\s+ETA\s+(\S+)`)

	for scanner.Scan() {
		line := scanner.Text()

		if matches := progressRegex.FindStringSubmatch(line); len(matches) >= 4 {
			percent, _ := strconv.ParseFloat(matches[1], 64)
			c.emitProgress(DownloadProgress{
				Percent: percent,
				Speed:   matches[2],
				ETA:     matches[3],
				Status:  "downloading",
			})
		} else if strings.Contains(line, "[Merger]") || strings.Contains(line, "Merging") {
			c.emitProgress(DownloadProgress{
				Percent: 100,
				Status:  "merging",
			})
		}
	}

	if err := cmd.Wait(); err != nil {
		c.emitProgress(DownloadProgress{Status: "error"})
		return err
	}

	c.emitProgress(DownloadProgress{
		Percent: 100,
		Status:  "complete",
	})

	return nil
}

func (c *Client) emitProgress(progress DownloadProgress) {
	if c.ctx == nil {
		return
	}
	wailsRuntime.EventsEmit(c.ctx, events.DownloadProgress, progress)
}

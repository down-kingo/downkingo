package clipboard

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"kingo/internal/logger"

	toast "git.sr.ht/~jackmordaunt/go-toast/v2"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// supportedDomains lista os domínios de mídia que o Kingo suporta.
// A validação é feita via net/url, não regex.
var supportedDomains = []string{
	"youtube.com", "youtu.be",
	"instagram.com",
	"tiktok.com",
	"twitter.com", "x.com",
	"facebook.com", "fb.watch",
	"twitch.tv",
	"vimeo.com",
	"dailymotion.com",
	"pinterest.com",
	"reddit.com",
	"threads.net",
	"soundcloud.com",
}

type Monitor struct {
	cancel    context.CancelFunc
	done      chan struct{}
	mu        sync.Mutex
	lastText  string
	isRunning bool
	iconPath  string
}

// NewMonitor creates a clipboard monitor. iconPNG is the raw PNG bytes for the notification icon.
func NewMonitor(iconPNG []byte) *Monitor {
	m := &Monitor{}
	if len(iconPNG) > 0 {
		p := filepath.Join(os.TempDir(), "downkingo-notify-icon.png")
		if err := os.WriteFile(p, iconPNG, 0644); err == nil {
			m.iconPath = p
		} else {
			logger.Log.Warn().Err(err).Msg("failed to write notification icon to temp")
		}
	}
	return m
}

func (m *Monitor) Start(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.isRunning {
		return
	}

	monitorCtx, cancel := context.WithCancel(ctx)
	m.cancel = cancel
	m.done = make(chan struct{})
	m.isRunning = true

	// Wails v3: use application.Get().Clipboard.Text()
	if app := application.Get(); app != nil {
		if text, ok := app.Clipboard.Text(); ok {
			m.lastText = text
		}
	}

	go m.loop(monitorCtx, m.done)
	logger.Log.Info().Msg("Clipboard monitor started")
}

func (m *Monitor) Stop() {
	m.mu.Lock()
	if !m.isRunning {
		m.mu.Unlock()
		return
	}

	cancel := m.cancel
	done := m.done
	m.cancel = nil
	m.done = nil
	m.isRunning = false
	m.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	if done != nil {
		<-done
	}
	logger.Log.Info().Msg("Clipboard monitor stopped")
}

// Adaptive backoff constants for CPU efficiency
const (
	minPollInterval = 500 * time.Millisecond // Fast polling when active
	maxPollInterval = 3 * time.Second        // Slow polling when idle
	backoffFactor   = 2                      // Exponential growth rate
)

func (m *Monitor) loop(ctx context.Context, done chan<- struct{}) {
	defer close(done)
	currentInterval := minPollInterval
	timer := time.NewTimer(currentInterval)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			app := application.Get()
			if app == nil {
				currentInterval = minDuration(currentInterval*backoffFactor, maxPollInterval)
				timer.Reset(currentInterval)
				continue
			}
			text, ok := app.Clipboard.Text()
			if !ok {
				// On error, increase backoff to avoid hammering
				currentInterval = minDuration(currentInterval*backoffFactor, maxPollInterval)
				timer.Reset(currentInterval)
				continue
			}

			m.mu.Lock()
			changed := text != m.lastText
			if changed {
				m.lastText = text
			}
			m.mu.Unlock()

			if changed {
				// Reset to fast polling on clipboard change
				currentInterval = minPollInterval
				logger.Log.Debug().Str("content_preview", limitString(text, 50)).Msg("Clipboard content changed")

				if m.isValidURL(text) {
					logger.Log.Info().Str("url", text).Msg("Clipboard link detected and valid")
					m.sendNotification(text)
				} else {
					logger.Log.Debug().Msg("Clipboard ignored (invalid URL or unsupported domain)")
				}
			} else {
				// Increase backoff when idle
				currentInterval = minDuration(currentInterval*backoffFactor, maxPollInterval)
			}
			timer.Reset(currentInterval)
		}
	}
}

// minDuration returns the smaller of two durations
func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}

// limitString é um helper para logs
func limitString(s string, max int) string {
	runes := []rune(s)
	if len(runes) > max {
		return string(runes[:max]) + "..."
	}
	return s
}

// platformName returns a friendly display name for the detected media platform.
func platformName(rawURL string) string {
	platforms := map[string]string{
		"youtube.com":     "YouTube",
		"youtu.be":        "YouTube",
		"instagram.com":   "Instagram",
		"tiktok.com":      "TikTok",
		"twitter.com":     "Twitter / X",
		"x.com":           "Twitter / X",
		"facebook.com":    "Facebook",
		"fb.watch":        "Facebook",
		"twitch.tv":       "Twitch",
		"vimeo.com":       "Vimeo",
		"dailymotion.com": "Dailymotion",
		"pinterest.com":   "Pinterest",
		"reddit.com":      "Reddit",
		"threads.net":     "Threads",
		"soundcloud.com":  "SoundCloud",
	}
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "Link"
	}
	host := strings.ToLower(parsed.Hostname())
	for domain, name := range platforms {
		if hostMatchesDomain(host, domain) {
			return name
		}
	}
	return "Link"
}

func (m *Monitor) sendNotification(detectedURL string) {
	platform := platformName(detectedURL)
	title := fmt.Sprintf("🔗 %s link detectado", platform)

	n := toast.Notification{
		AppID: "DownKingo",
		Title: title,
		Body:  limitString(detectedURL, 80),
		Icon:  m.iconPath,
		Actions: []toast.Action{
			{Type: toast.Protocol, Content: "Download", Arguments: "downkingo:download:" + detectedURL},
		},
		ActivationArguments: "downkingo:download:" + detectedURL,
	}

	if err := n.Push(); err != nil {
		logger.Log.Warn().Err(err).Str("url", detectedURL).Msg("failed to send native notification, falling back to event")
		if app := application.Get(); app != nil {
			app.Event.Emit("clipboard:link-detected", detectedURL)
		}
		return
	}

	// Emit event immediately so frontend can fill URL when notification appears
	if app := application.Get(); app != nil {
		app.Event.Emit("clipboard:link-detected", detectedURL)
	}
}

func (m *Monitor) isValidURL(text string) bool {
	// Trim espaços em branco
	text = strings.TrimSpace(text)

	// Parse estrutural da URL (RFC 3986)
	parsedURL, err := url.Parse(text)
	if err != nil {
		return false
	}

	// Deve ter scheme http ou https
	scheme := strings.ToLower(parsedURL.Scheme)
	if scheme != "http" && scheme != "https" {
		return false
	}

	// Deve ter host não-vazio
	host := strings.ToLower(parsedURL.Hostname())
	if host == "" {
		return false
	}

	// Verifica se é um domínio de mídia suportado
	for _, domain := range supportedDomains {
		if hostMatchesDomain(host, domain) {
			return true
		}
	}

	return false
}

func hostMatchesDomain(host, domain string) bool {
	host = strings.TrimSuffix(strings.ToLower(host), ".")
	domain = strings.TrimSuffix(strings.ToLower(domain), ".")
	return host == domain || strings.HasSuffix(host, "."+domain)
}

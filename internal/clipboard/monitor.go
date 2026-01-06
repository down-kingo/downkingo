package clipboard

import (
	"context"
	"net/url"
	"strings"
	"sync"
	"time"

	"kingo/internal/logger"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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
	ctx       context.Context
	cancel    context.CancelFunc
	mu        sync.Mutex
	lastText  string
	isRunning bool
}

func NewMonitor() *Monitor {
	return &Monitor{}
}

func (m *Monitor) Start(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.isRunning {
		return
	}

	m.ctx, m.cancel = context.WithCancel(ctx)
	m.isRunning = true

	// Wails v2: use runtime
	if text, err := runtime.ClipboardGetText(ctx); err == nil {
		m.lastText = text
	}

	go m.loop()
	logger.Log.Info().Msg("Clipboard monitor started")
}

func (m *Monitor) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.isRunning {
		return
	}

	if m.cancel != nil {
		m.cancel()
	}
	m.isRunning = false
	logger.Log.Info().Msg("Clipboard monitor stopped")
}

func (m *Monitor) loop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-m.ctx.Done():
			return
		case <-ticker.C:
			text, err := runtime.ClipboardGetText(m.ctx)
			if err != nil {
				continue
			}

			if text != m.lastText {
				logger.Log.Info().Str("content_preview", limitString(text, 50)).Msg("Clipboard content changed")
				m.lastText = text

				if m.isValidURL(text) {
					logger.Log.Info().Str("url", text).Msg("Clipboard link detected and valid")
					runtime.EventsEmit(m.ctx, "clipboard:link-detected", text)
				} else {
					logger.Log.Info().Msg("Clipboard ignored (invalid URL or unsupported domain)")
				}
			}
		}
	}
}

// limitString é um helper para logs
func limitString(s string, max int) string {
	if len(s) > max {
		return s[:max] + "..."
	}
	return s
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
	host := strings.ToLower(parsedURL.Host)
	if host == "" {
		return false
	}

	// Verifica se é um domínio de mídia suportado
	for _, domain := range supportedDomains {
		if strings.Contains(host, domain) {
			return true
		}
	}

	return false
}

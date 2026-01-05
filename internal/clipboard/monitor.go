package clipboard

import (
	"context"
	"regexp"
	"strings"
	"sync"
	"time"

	"kingo/internal/logger"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type Monitor struct {
	ctx       context.Context
	cancel    context.CancelFunc
	mu        sync.Mutex
	lastText  string
	isRunning bool
	urlRegex  *regexp.Regexp
}

func NewMonitor() *Monitor {
	regex := regexp.MustCompile(`(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)`)

	return &Monitor{
		urlRegex: regex,
	}
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
	if !m.urlRegex.MatchString(text) {
		return false
	}

	// Filtra apenas domínios de mídia suportados
	supported := []string{
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

	input := strings.ToLower(text)
	for _, domain := range supported {
		if strings.Contains(input, domain) {
			return true
		}
	}
	return false
}

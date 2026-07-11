package telemetry

import (
	"bytes"
	"encoding/json"
	"kingo/internal/config"
	"kingo/internal/logger"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
)

// AptabaseKey is the App Key for telemetry.
// Get your key at https://aptabase.com
// This variable should be set at build time using -ldflags.
// Example: -ldflags "-X 'kingo/internal/telemetry.AptabaseKey=A-EU-XXXXXXXX'"
var AptabaseKey = "APTABASE_KEY"

const apiURL = "https://api.aptabase.com/v0/event"

type Service struct {
	cfg     *config.Config
	version string
}

func NewService(cfg *config.Config, version string) *Service {
	return &Service{
		cfg:     cfg,
		version: version,
	}
}

// TrackAppStart sends an 'app_started' event if telemetry is enabled.
func (s *Service) TrackAppStart() {
	if !s.isEnabled() {
		return
	}

	go func() {
		if err := s.sendEvent("app_started", nil); err != nil {
			// Fail silently, maybe log at debug level
			logger.Log.Debug().Err(err).Msg("failed to send telemetry")
		}
	}()
}

func (s *Service) isEnabled() bool {
	// Anonymous mode disables all tracking
	if s.cfg.Get().AnonymousMode {
		return false
	}
	// Check if key is valid (basic check)
	if AptabaseKey == "APTABASE_KEY" || AptabaseKey == "" {
		return false
	}
	return true
}

type eventPayload struct {
	Timestamp   string                 `json:"timestamp"`
	SessionID   string                 `json:"sessionId"`
	EventName   string                 `json:"eventName"`
	SystemProps systemProps            `json:"systemProps"`
	Props       map[string]interface{} `json:"props,omitempty"`
}

type systemProps struct {
	IsDebug    bool   `json:"isDebug"`
	OSName     string `json:"osName"`
	OSVersion  string `json:"osVersion"`
	Locale     string `json:"locale"`
	AppVersion string `json:"appVersion"`
	SDKVersion string `json:"sdkVersion"`
}

func (s *Service) sendEvent(name string, props map[string]interface{}) error {
	sessionID := uuid.New().String()

	payload := eventPayload{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		SessionID: sessionID,
		EventName: name,
		SystemProps: systemProps{
			IsDebug:    false,
			OSName:     runtime.GOOS,
			OSVersion:  runtime.GOARCH,
			Locale:     getSystemLocale(),
			AppVersion: s.version,
			SDKVersion: "go-wails-custom",
		},
		Props: props,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("App-Key", AptabaseKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		logger.Log.Debug().Int("status", resp.StatusCode).Msg("telemetry refused")
		return nil
	}

	return nil
}

// getSystemLocale detects the OS locale. Returns "en-US" as fallback.
func getSystemLocale() string {
	// Try env vars first (works on all platforms, no subprocess needed)
	for _, env := range []string{"LANG", "LC_ALL", "LC_MESSAGES"} {
		if val := os.Getenv(env); val != "" {
			return normalizeLocale(strings.SplitN(val, ".", 2)[0])
		}
	}

	// Platform-specific detection (uses syscall on Windows, env on Unix)
	if locale := getOSLocale(); locale != "" {
		return locale
	}

	return "en-US"
}

// normalizeLocale converts "pt_BR" → "pt-BR"
func normalizeLocale(s string) string {
	return strings.ReplaceAll(s, "_", "-")
}

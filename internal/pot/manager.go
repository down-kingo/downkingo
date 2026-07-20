package pot

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	urlpkg "net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	providerHost       = "127.0.0.1"
	providerStartLimit = 30 * time.Second
	providerPingLimit  = 2 * time.Second
	providerStartTries = 3
)

// Manager owns the PO provider process for the lifetime of the application.
type Manager struct {
	ctx         context.Context
	binaryPath  string
	pluginPath  string
	cacheDir    string
	httpClient  *http.Client
	logCallback func(string)

	startMu sync.Mutex
	mu      sync.RWMutex
	cmd     *exec.Cmd
	done    chan struct{}
	baseURL string
}

// SetLogCallback reports lifecycle diagnostics without exposing generated
// tokens or provider request payloads.
func (m *Manager) SetLogCallback(callback func(string)) {
	m.mu.Lock()
	m.logCallback = callback
	m.mu.Unlock()
}

func (m *Manager) log(message string) {
	m.mu.RLock()
	callback := m.logCallback
	m.mu.RUnlock()
	if callback != nil {
		callback(message)
	}
}

// NewManager creates a provider manager without starting the sidecar. Startup
// is lazy so non-YouTube extractors never depend on this component.
func NewManager(ctx context.Context, binaryPath, pluginPath, cacheDir string) *Manager {
	if ctx == nil {
		ctx = context.Background()
	}
	return &Manager{
		ctx:        ctx,
		binaryPath: binaryPath,
		pluginPath: pluginPath,
		cacheDir:   cacheDir,
		httpClient: &http.Client{Timeout: providerPingLimit},
	}
}

// YtDlpArgs implements youtube.OptionsProvider. It starts the provider only for
// YouTube URLs and returns the documented plugin arguments.
func (m *Manager) YtDlpArgs(ctx context.Context, rawURL string, authenticated bool) ([]string, error) {
	if !isYouTubeURL(rawURL) {
		return nil, nil
	}
	if err := m.EnsureRunning(ctx); err != nil {
		return nil, fmt.Errorf("a verificação automática do YouTube não pôde ser iniciada: %w", err)
	}

	m.mu.RLock()
	baseURL := m.baseURL
	m.mu.RUnlock()
	args := buildYtDlpArgs(filepath.Dir(m.pluginPath), baseURL, authenticated)
	return args, nil
}

func buildYtDlpArgs(pluginDir, baseURL string, authenticated bool) []string {
	args := []string{
		// yt-dlp plugins execute arbitrary Python. Restrict the desktop app to
		// the exact archive downloaded and verified by DownKingo.
		"--no-plugin-dirs",
		"--plugin-dirs", pluginDir,
		"--extractor-args", "youtubepot-bgutilhttp:base_url=" + baseURL,
	}
	if !authenticated {
		// This is the client recommended by yt-dlp's current PO Token Guide.
		args = append(args, "--extractor-args", "youtube:player_client=mweb")
	}
	return args
}

// EnsureRunning health-checks the current process and restarts it when needed.
func (m *Manager) EnsureRunning(ctx context.Context) error {
	if ctx == nil {
		ctx = context.Background()
	}
	m.startMu.Lock()
	defer m.startMu.Unlock()

	if m.healthy(ctx) {
		return nil
	}
	m.mu.RLock()
	restarting := m.cmd != nil
	m.mu.RUnlock()
	if restarting {
		m.log("[YouTube] Reiniciando o provedor automático de PO Token...")
	} else {
		m.log("[YouTube] Iniciando o provedor automático de PO Token...")
	}
	m.stopProcess()

	if _, err := ValidateBinary(m.binaryPath); err != nil {
		m.log("[YouTube] ✗ O binário do provedor PO não passou na validação.")
		return err
	}
	if err := ValidatePlugin(m.pluginPath); err != nil {
		m.log("[YouTube] ✗ O plugin PO do yt-dlp não passou na validação.")
		return err
	}
	if err := os.MkdirAll(m.cacheDir, 0755); err != nil {
		return fmt.Errorf("create PO provider cache: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt < providerStartTries; attempt++ {
		port, err := availablePort()
		if err != nil {
			return err
		}
		baseURL := "http://" + providerHost + ":" + strconv.Itoa(port)
		if err := m.startProcess(baseURL, port); err != nil {
			lastErr = err
			continue
		}
		if err := m.waitUntilHealthy(ctx, baseURL); err == nil {
			m.log("[YouTube] ✓ Provedor PO v" + SupportedVersion + " pronto e conectado ao yt-dlp.")
			return nil
		} else {
			lastErr = err
			m.stopProcess()
		}
	}
	m.log("[YouTube] ✗ O provedor PO não ficou pronto para atender ao yt-dlp.")
	return fmt.Errorf("PO provider failed to become ready: %w", lastErr)
}

func (m *Manager) startProcess(baseURL string, port int) error {
	cmd := exec.CommandContext(
		m.ctx,
		m.binaryPath,
		"server",
		"--host", providerHost,
		"--port", strconv.Itoa(port),
	)
	cmd.Dir = filepath.Dir(m.binaryPath)
	cmd.Env = append(cmd.Environ(), "RUST_LOG=warn", "CACHE_DIR="+m.cacheDir)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	hideWindow(cmd)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start PO provider: %w", err)
	}

	done := make(chan struct{})
	m.mu.Lock()
	m.cmd = cmd
	m.done = done
	m.baseURL = baseURL
	m.mu.Unlock()

	go func() {
		_ = cmd.Wait()
		m.mu.Lock()
		if m.cmd == cmd {
			m.cmd = nil
			m.done = nil
			m.baseURL = ""
		}
		close(done)
		m.mu.Unlock()
	}()
	return nil
}

func (m *Manager) waitUntilHealthy(ctx context.Context, baseURL string) error {
	deadlineCtx, cancel := context.WithTimeout(ctx, providerStartLimit)
	defer cancel()
	ticker := time.NewTicker(150 * time.Millisecond)
	defer ticker.Stop()
	for {
		if m.ping(deadlineCtx, baseURL) {
			return nil
		}
		select {
		case <-deadlineCtx.Done():
			return deadlineCtx.Err()
		case <-ticker.C:
		}
	}
}

func (m *Manager) healthy(ctx context.Context) bool {
	m.mu.RLock()
	baseURL := m.baseURL
	cmd := m.cmd
	m.mu.RUnlock()
	return cmd != nil && baseURL != "" && m.ping(ctx, baseURL)
}

func (m *Manager) ping(ctx context.Context, baseURL string) bool {
	pingCtx, cancel := context.WithTimeout(ctx, providerPingLimit)
	defer cancel()
	req, err := http.NewRequestWithContext(pingCtx, http.MethodGet, baseURL+"/ping", nil)
	if err != nil {
		return false
	}
	resp, err := m.httpClient.Do(req)
	if err != nil {
		return false
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	_ = resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// Stop terminates the managed sidecar and waits briefly for it to exit.
func (m *Manager) Stop() {
	m.startMu.Lock()
	defer m.startMu.Unlock()
	m.stopProcess()
}

func (m *Manager) stopProcess() {
	m.mu.RLock()
	cmd := m.cmd
	done := m.done
	m.mu.RUnlock()
	if cmd == nil {
		return
	}
	if cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
	if done != nil {
		select {
		case <-done:
		case <-time.After(2 * time.Second):
		}
	}
}

func availablePort() (int, error) {
	listener, err := net.Listen("tcp", providerHost+":0")
	if err != nil {
		return 0, fmt.Errorf("reserve PO provider port: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	if err := listener.Close(); err != nil {
		return 0, err
	}
	return port, nil
}

func isYouTubeURL(rawURL string) bool {
	parsed, err := urlpkg.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return false
	}
	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	return host == "youtu.be" || host == "youtube.com" || strings.HasSuffix(host, ".youtube.com")
}

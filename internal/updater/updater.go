package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	GitHubOwner   = "down-kingo"
	GitHubRepo    = "downkingo"
	maxUpdateSize = 1024 * 1024 * 1024 // 1 GiB safety limit
)

// HTTP client with timeout for API calls
var httpClient = &http.Client{
	Timeout: 30 * time.Second,
}

// HTTP client with longer timeout for downloads
var downloadClient = &http.Client{
	Timeout: 10 * time.Minute,
}

// Release represents a GitHub release
type Release struct {
	TagName     string  `json:"tag_name"`
	Name        string  `json:"name"`
	Body        string  `json:"body"` // Changelog
	PublishedAt string  `json:"published_at"`
	Prerelease  bool    `json:"prerelease"`
	Assets      []Asset `json:"assets"`
}

// Asset represents a release asset
type Asset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

// UpdateInfo contains update check result
type UpdateInfo struct {
	Available   bool   `json:"available"`
	CurrentVer  string `json:"currentVersion"`
	LatestVer   string `json:"latestVersion"`
	Changelog   string `json:"changelog"`
	DownloadURL string `json:"downloadUrl"`
	Size        int64  `json:"size"`
}

// Updater handles auto-updates via GitHub releases
type Updater struct {
	ctx            context.Context
	currentVersion string
}

// NewUpdater creates a new updater instance
func NewUpdater(currentVersion string) *Updater {
	return &Updater{
		currentVersion: currentVersion,
	}
}

// SetContext sets the Wails runtime context (kept for interface compatibility)
func (u *Updater) SetContext(ctx context.Context) {
	u.ctx = ctx
}

// GetAvailableReleases fetches all releases from GitHub
func (u *Updater) GetAvailableReleases() ([]Release, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases", GitHubOwner, GitHubRepo)

	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned %d", resp.StatusCode)
	}

	var releases []Release
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, err
	}

	return releases, nil
}

// CheckForUpdate checks GitHub for a newer release
func (u *Updater) CheckForUpdate() (*UpdateInfo, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", GitHubOwner, GitHubRepo)

	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return &UpdateInfo{
			Available:  false,
			CurrentVer: u.currentVersion,
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned %d", resp.StatusCode)
	}

	var release Release
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}

	latestVer := strings.TrimPrefix(release.TagName, "v")
	currentVer := strings.TrimPrefix(u.currentVersion, "v")

	info := &UpdateInfo{
		Available:  compareVersions(currentVer, latestVer) < 0,
		CurrentVer: currentVer,
		LatestVer:  latestVer,
		Changelog:  cleanChangelog(release.Body),
	}

	// Find the installer/binary published for the current OS. Windows releases
	// historically use the generic DownKingo.exe name, so matching only the
	// word "windows" makes the modal open with an empty URL and a dead button.
	if asset, ok := selectAssetForOS(release.Assets, runtime.GOOS); ok {
		info.DownloadURL = asset.BrowserDownloadURL
		info.Size = asset.Size
	}

	return info, nil
}

// compareVersions compares two semver strings numerically.
// Returns -1 if a < b, 0 if a == b, 1 if a > b.
func compareVersions(a, b string) int {
	aParts := strings.Split(a, ".")
	bParts := strings.Split(b, ".")

	maxLen := len(aParts)
	if len(bParts) > maxLen {
		maxLen = len(bParts)
	}

	for i := 0; i < maxLen; i++ {
		var aNum, bNum int
		if i < len(aParts) {
			aNum, _ = strconv.Atoi(aParts[i])
		}
		if i < len(bParts) {
			bNum, _ = strconv.Atoi(bParts[i])
		}
		if aNum < bNum {
			return -1
		}
		if aNum > bNum {
			return 1
		}
	}
	return 0
}

// selectAssetForOS returns the best compatible release artifact. The exact
// Windows installer name is preferred so the updater never mistakes an
// arbitrary executable attached to the release for the application update.
func selectAssetForOS(assets []Asset, goos string) (Asset, bool) {
	if goos == "windows" {
		for _, asset := range assets {
			if strings.EqualFold(asset.Name, "DownKingo.exe") {
				return asset, true
			}
		}

		for _, asset := range assets {
			name := strings.ToLower(asset.Name)
			if strings.HasSuffix(name, ".exe") &&
				(strings.Contains(name, "installer") || strings.Contains(name, "setup")) {
				return asset, true
			}
		}

		return Asset{}, false
	}

	wanted := "linux"
	if goos == "darwin" {
		wanted = "darwin"
	}
	for _, asset := range assets {
		if strings.Contains(strings.ToLower(asset.Name), wanted) {
			return asset, true
		}
	}

	return Asset{}, false
}

func isTrustedUpdateURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme != "https" || !strings.EqualFold(parsed.Hostname(), "github.com") {
		return false
	}

	prefix := fmt.Sprintf("/%s/%s/releases/download/", GitHubOwner, GitHubRepo)
	return strings.HasPrefix(parsed.EscapedPath(), prefix)
}

// cleanChangelog removes unnecessary GitHub compare links and cleans up the changelog
func cleanChangelog(body string) string {
	lines := strings.Split(body, "\n")
	var cleaned []string

	for _, line := range lines {
		if strings.Contains(line, "**Full Changelog**:") ||
			strings.Contains(line, "Full Changelog:") ||
			strings.Contains(line, "/compare/") {
			continue
		}
		if len(cleaned) == 0 && strings.TrimSpace(line) == "" {
			continue
		}
		cleaned = append(cleaned, line)
	}

	for len(cleaned) > 0 && strings.TrimSpace(cleaned[len(cleaned)-1]) == "" {
		cleaned = cleaned[:len(cleaned)-1]
	}

	result := strings.Join(cleaned, "\n")

	if strings.TrimSpace(result) == "" {
		return "Correções de bugs e melhorias de desempenho."
	}

	return result
}

// DownloadAndApply downloads the update and launches the external updater.
func (u *Updater) DownloadAndApply(downloadURL string) error {
	if len(updaterBinary) == 0 {
		return fmt.Errorf("updater not available (dev mode)")
	}
	if !isTrustedUpdateURL(downloadURL) {
		return fmt.Errorf("untrusted update URL")
	}

	u.emitProgress("downloading", 0)

	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}
	execPath, err = filepath.EvalSymlinks(execPath)
	if err != nil {
		return fmt.Errorf("failed to resolve executable path: %w", err)
	}

	// Download the installer/binary to a unique file in the user's temp folder.
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}
	tempFile, err := os.CreateTemp("", "downkingo-update-*"+ext)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tempPath := tempFile.Name()
	keepTemp := false
	defer func() {
		_ = tempFile.Close()
		if !keepTemp {
			_ = os.Remove(tempPath)
		}
	}()

	resp, err := downloadClient.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("update download returned HTTP %d", resp.StatusCode)
	}
	if resp.ContentLength > maxUpdateSize {
		return fmt.Errorf("update file is larger than the allowed limit")
	}

	total := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			downloaded += int64(n)
			if downloaded > maxUpdateSize {
				return fmt.Errorf("update file is larger than the allowed limit")
			}
			if _, writeErr := tempFile.Write(buf[:n]); writeErr != nil {
				return fmt.Errorf("failed to write update to disk: %w", writeErr)
			}
			if total > 0 {
				percent := float64(downloaded) / float64(total) * 100
				u.emitProgress("downloading", percent)
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("download interrupted: %w", readErr)
		}
	}
	if err := tempFile.Close(); err != nil {
		return fmt.Errorf("failed to finish update download: %w", err)
	}

	u.emitProgress("applying", 100)

	// Extract the embedded updater to a unique path. A fixed filename can still
	// be locked by a previous update attempt on Windows.
	updaterFile, err := os.CreateTemp("", "downkingo-updater-*"+ext)
	if err != nil {
		return fmt.Errorf("failed to create updater helper: %w", err)
	}
	updaterPath := updaterFile.Name()
	if _, err := updaterFile.Write(updaterBinary); err != nil {
		_ = updaterFile.Close()
		_ = os.Remove(updaterPath)
		return fmt.Errorf("failed to extract updater: %w", err)
	}
	if err := updaterFile.Close(); err != nil {
		_ = os.Remove(updaterPath)
		return fmt.Errorf("failed to finish updater helper: %w", err)
	}
	if err := os.Chmod(updaterPath, 0755); err != nil {
		_ = os.Remove(updaterPath)
		return fmt.Errorf("failed to prepare updater helper: %w", err)
	}

	// Launch the external updater process. On Windows the published artifact is
	// an NSIS installer. The helper waits for this app to exit and then opens the
	// installer with UAC elevation, avoiding writes to Program Files from the
	// unelevated application process.
	pid := os.Getpid()
	args := []string{"--pid", strconv.Itoa(pid), "--cleanup", updaterPath}
	if runtime.GOOS == "windows" {
		args = append(args, "--installer", tempPath)
	} else {
		args = append(args, "--old", execPath, "--new", tempPath)
	}
	cmd := exec.Command(updaterPath, args...)
	hideUpdaterWindow(cmd)
	if err := cmd.Start(); err != nil {
		os.Remove(updaterPath)
		return fmt.Errorf("failed to launch updater: %w", err)
	}
	keepTemp = true

	u.emitProgress("restarting", 100)

	// Quit the app. The helper waits for the process to release its files before
	// starting the installer or replacing a portable binary.
	go func() {
		time.Sleep(500 * time.Millisecond)
		application.Get().Quit()
	}()

	return nil
}

// RestartApp quits the application (kept for interface compatibility).
func (u *Updater) RestartApp() {
	application.Get().Quit()
}

// InstallVersion finds a release by tag and installs it
func (u *Updater) InstallVersion(tag string) error {
	releases, err := u.GetAvailableReleases()
	if err != nil {
		return err
	}

	var targetRelease *Release
	for i := range releases {
		if releases[i].TagName == tag {
			targetRelease = &releases[i]
			break
		}
	}

	if targetRelease == nil {
		return fmt.Errorf("version %s not found", tag)
	}

	asset, ok := selectAssetForOS(targetRelease.Assets, runtime.GOOS)
	if !ok {
		return fmt.Errorf("no compatible asset found for %s", tag)
	}

	return u.DownloadAndApply(asset.BrowserDownloadURL)
}

func (u *Updater) emitProgress(status string, percent float64) {
	application.Get().Event.Emit("updater:progress", map[string]interface{}{
		"status":  status,
		"percent": percent,
	})
}

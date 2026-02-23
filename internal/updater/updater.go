package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
	GitHubOwner = "down-kingo"
	GitHubRepo  = "downkingo"
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

	// Find appropriate asset for current OS
	assetName := u.getAssetName()
	for _, asset := range release.Assets {
		if strings.Contains(strings.ToLower(asset.Name), assetName) {
			info.DownloadURL = asset.BrowserDownloadURL
			info.Size = asset.Size
			break
		}
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

// getAssetName returns the expected asset name for current OS
func (u *Updater) getAssetName() string {
	switch runtime.GOOS {
	case "windows":
		return "windows"
	case "darwin":
		return "darwin"
	default:
		return "linux"
	}
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

// DownloadAndApply downloads the update and launches the external updater to replace the binary.
func (u *Updater) DownloadAndApply(downloadURL string) error {
	if len(updaterBinary) == 0 {
		return fmt.Errorf("updater not available (dev mode)")
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

	// Download new binary to temp
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}
	tempPath := filepath.Join(os.TempDir(), "downkingo-update"+ext)

	resp, err := downloadClient.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	out, err := os.Create(tempPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}

	total := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := out.Write(buf[:n]); writeErr != nil {
				out.Close()
				os.Remove(tempPath)
				return fmt.Errorf("failed to write update to disk: %w", writeErr)
			}
			downloaded += int64(n)
			if total > 0 {
				percent := float64(downloaded) / float64(total) * 100
				u.emitProgress("downloading", percent)
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			out.Close()
			os.Remove(tempPath)
			return fmt.Errorf("download interrupted: %w", readErr)
		}
	}
	out.Close()

	u.emitProgress("applying", 100)

	// Extract the embedded updater binary to temp
	updaterPath := filepath.Join(os.TempDir(), "downkingo-updater"+ext)
	if err := os.WriteFile(updaterPath, updaterBinary, 0755); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to extract updater: %w", err)
	}

	// Launch the external updater process
	pid := os.Getpid()
	cmd := exec.Command(updaterPath,
		"--pid", strconv.Itoa(pid),
		"--old", execPath,
		"--new", tempPath,
		"--cleanup", updaterPath,
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		os.Remove(tempPath)
		os.Remove(updaterPath)
		return fmt.Errorf("failed to launch updater: %w", err)
	}

	u.emitProgress("restarting", 100)

	// Quit the app — the external updater will wait for us to exit, then replace the binary and relaunch
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

	assetName := u.getAssetName()
	var downloadURL string
	for _, asset := range targetRelease.Assets {
		if strings.Contains(strings.ToLower(asset.Name), assetName) {
			downloadURL = asset.BrowserDownloadURL
			break
		}
	}

	if downloadURL == "" {
		return fmt.Errorf("no compatible asset found for %s", tag)
	}

	return u.DownloadAndApply(downloadURL)
}

func (u *Updater) emitProgress(status string, percent float64) {
	application.Get().Event.Emit("updater:progress", map[string]interface{}{
		"status":  status,
		"percent": percent,
	})
}

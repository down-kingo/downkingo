package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
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

	// Use client with 30s timeout
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// No releases yet
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
		Available:  latestVer != currentVer && latestVer > currentVer,
		CurrentVer: strings.TrimPrefix(u.currentVersion, "v"),
		LatestVer:  latestVer, // Remove 'v' prefix - frontend will add it
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
		// Skip "Full Changelog" lines with compare links
		if strings.Contains(line, "**Full Changelog**:") ||
			strings.Contains(line, "Full Changelog:") ||
			strings.Contains(line, "/compare/") {
			continue
		}
		// Skip empty lines at the start
		if len(cleaned) == 0 && strings.TrimSpace(line) == "" {
			continue
		}
		cleaned = append(cleaned, line)
	}

	// Trim trailing empty lines
	for len(cleaned) > 0 && strings.TrimSpace(cleaned[len(cleaned)-1]) == "" {
		cleaned = cleaned[:len(cleaned)-1]
	}

	result := strings.Join(cleaned, "\n")

	// If empty, return a default message
	if strings.TrimSpace(result) == "" {
		return "Correções de bugs e melhorias de desempenho."
	}

	return result
}

// DownloadAndApply downloads and installs the update
func (u *Updater) DownloadAndApply(downloadURL string) error {
	u.emitProgress("downloading", 0)

	// Get current executable path
	execPath, err := os.Executable()
	if err != nil {
		return err
	}

	// Download to temp file with longer timeout
	resp, err := downloadClient.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	tempPath := filepath.Join(os.TempDir(), "downkingo-update.exe")
	out, err := os.Create(tempPath)
	if err != nil {
		return err
	}

	total := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)

	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			out.Write(buf[:n])
			downloaded += int64(n)
			percent := float64(downloaded) / float64(total) * 100
			u.emitProgress("downloading", percent)
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			out.Close()
			os.Remove(tempPath)
			return err
		}
	}
	out.Close()

	u.emitProgress("applying", 100)

	// Atomic replace: rename current to .old, rename new to current
	oldPath := execPath + ".old"
	os.Remove(oldPath) // Remove any existing .old file

	if err := os.Rename(execPath, oldPath); err != nil {
		return fmt.Errorf("failed to backup current executable: %w", err)
	}

	if err := os.Rename(tempPath, execPath); err != nil {
		// Try to restore the old executable
		os.Rename(oldPath, execPath)
		return fmt.Errorf("failed to install update: %w", err)
	}

	u.emitProgress("complete", 100)
	return nil
}

// RestartApp restarts the application using Wails v3 API
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

package launcher

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"time"

	"kingo/internal/events"
	"kingo/internal/logger"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// HTTP client with optimized transport for large downloads
var httpClient = &http.Client{
	Timeout: 60 * time.Minute, // Increased to support slow connections (e.g., < 4Mbps)
	Transport: &http.Transport{
		MaxIdleConns:        10,
		MaxIdleConnsPerHost: 5,
		IdleConnTimeout:     90 * time.Second,
		DisableKeepAlives:   false,
	},
}

// Dependency represents a required binary
type Dependency struct {
	Name           string
	URL            string
	FileName       string
	IsArchive      bool     // Needs extraction (zip/tar.gz)
	ArchiveType    string   // "zip" or "tar.gz"
	ExtractTargets []string // Names of the files to extract
	SHA256         string   // Expected checksum (empty = skip verification)
}

// Launcher handles dependency checking and downloading
type Launcher struct {
	ctx    context.Context
	binDir string
	deps   []Dependency
}

// NewLauncher creates a new launcher instance with OS-specific dependencies
func NewLauncher(binDir string) *Launcher {
	return &Launcher{
		binDir: binDir,
		deps:   getDependencies(),
	}
}

// getDependencies returns OS-specific dependency configurations
func getDependencies() []Dependency {
	switch goruntime.GOOS {
	case "windows":
		return []Dependency{
			{
				Name:     "yt-dlp",
				URL:      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
				FileName: "yt-dlp.exe",
			},
			{
				Name:           "FFmpeg",
				URL:            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
				FileName:       "ffmpeg.zip",
				IsArchive:      true,
				ArchiveType:    "zip",
				ExtractTargets: []string{"ffmpeg.exe", "ffprobe.exe"},
			},
		}
	case "darwin": // macOS
		return []Dependency{
			{
				Name:     "yt-dlp",
				URL:      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
				FileName: "yt-dlp",
			},
			{
				Name:           "FFmpeg",
				URL:            "https://evermeet.cx/ffmpeg/getrelease/zip",
				FileName:       "ffmpeg.zip",
				IsArchive:      true,
				ArchiveType:    "zip",
				ExtractTargets: []string{"ffmpeg", "ffprobe"},
			},
		}
	default: // Linux
		return []Dependency{
			{
				Name:     "yt-dlp",
				URL:      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
				FileName: "yt-dlp",
			},
			{
				Name:           "FFmpeg",
				URL:            "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
				FileName:       "ffmpeg.tar.xz",
				IsArchive:      true,
				ArchiveType:    "tar.xz",
				ExtractTargets: []string{"ffmpeg", "ffprobe"},
			},
		}
	}
}

// getFFmpegBinaryName returns the correct binary name for the OS
func getFFmpegBinaryName() string {
	if goruntime.GOOS == "windows" {
		return "ffmpeg.exe"
	}
	return "ffmpeg"
}

// getYtDlpBinaryName returns the correct binary name for the OS
func getYtDlpBinaryName() string {
	if goruntime.GOOS == "windows" {
		return "yt-dlp.exe"
	}
	return "yt-dlp"
}

// SetContext sets the context for cancellation (kept for interface compatibility)
func (l *Launcher) SetContext(ctx context.Context) {
	l.ctx = ctx
}

// DependencyStatus represents the status of a dependency
type DependencyStatus struct {
	Name      string `json:"name"`
	Installed bool   `json:"installed"`
	Size      int64  `json:"size"`
}

// CheckDependencies verifies which dependencies are installed
func (l *Launcher) CheckDependencies() []DependencyStatus {
	statuses := make([]DependencyStatus, 0, len(l.deps))

	for _, dep := range l.deps {
		installed := true
		var size int64

		// Check all targets if archive
		if dep.IsArchive {
			for _, target := range dep.ExtractTargets {
				targetFile := filepath.Join(l.binDir, target)
				info, err := os.Stat(targetFile)
				if err != nil || info.Size() == 0 {
					installed = false
					break
				}
				size += info.Size()
			}
		} else {
			// Single file download
			targetFile := filepath.Join(l.binDir, dep.FileName)
			info, err := os.Stat(targetFile)
			if err != nil || info.Size() == 0 {
				installed = false
			} else {
				size = info.Size()
			}
		}

		statuses = append(statuses, DependencyStatus{
			Name:      dep.Name,
			Installed: installed,
			Size:      size,
		})
	}

	return statuses
}

// NeedsDependencies returns true if any dependency is missing
func (l *Launcher) NeedsDependencies() bool {
	for _, status := range l.CheckDependencies() {
		if !status.Installed {
			return true
		}
	}
	return false
}

// DownloadProgress is emitted during download
type DownloadProgress struct {
	Name       string  `json:"name"`
	Downloaded int64   `json:"downloaded"`
	Total      int64   `json:"total"`
	Percent    float64 `json:"percent"`
	Status     string  `json:"status"` // downloading, extracting, verifying, complete, error
}

// DownloadDependencies downloads and installs all missing dependencies
func (l *Launcher) DownloadDependencies() error {
	for _, dep := range l.deps {
		installed := true

		if dep.IsArchive {
			for _, target := range dep.ExtractTargets {
				targetFile := filepath.Join(l.binDir, target)
				if info, err := os.Stat(targetFile); err != nil || info.Size() == 0 {
					installed = false
					break
				}
			}
		} else {
			targetFile := filepath.Join(l.binDir, getYtDlpBinaryName())
			if info, err := os.Stat(targetFile); err != nil || info.Size() == 0 {
				installed = false
			}
		}

		if installed {
			l.emitProgress(dep.Name, 100, 100, 100, "complete")
			continue
		}

		if err := l.downloadDependency(dep); err != nil {
			l.emitProgress(dep.Name, 0, 0, 0, "error")
			return fmt.Errorf("failed to download %s: %w", dep.Name, err)
		}
	}

	// Emit completion event using Wails v3 API
	l.emitEvent(events.LauncherComplete, nil)
	logger.Log.Info().Msg("all dependencies installed successfully")
	return nil
}

// DownloadAria2c baixa e instala o aria2c (download opcional, sob demanda)
func (l *Launcher) DownloadAria2c() error {
	var dep Dependency

	switch goruntime.GOOS {
	case "windows":
		dep = Dependency{
			Name:           "aria2c",
			URL:            "https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip",
			FileName:       "aria2c.zip",
			IsArchive:      true,
			ArchiveType:    "zip",
			ExtractTargets: []string{"aria2c.exe"},
		}
	default:
		// Linux/Mac: aria2c geralmente disponível via package manager
		return fmt.Errorf("aria2c download não suportado neste OS, instale via package manager")
	}

	// Verificar se já existe
	// Usa o primeiro alvo como referência principal
	targetFile := filepath.Join(l.binDir, dep.ExtractTargets[0])
	if info, err := os.Stat(targetFile); err == nil && info.Size() > 0 {
		return nil // Já instalado
	}

	return l.downloadDependency(dep)
}

func (l *Launcher) downloadDependency(dep Dependency) error {
	l.emitProgress(dep.Name, 0, 0, 0, "downloading")
	logger.Log.Info().Str("dependency", dep.Name).Str("url", dep.URL).Msg("starting download")

	// Create HTTP request with context for proper cancellation
	req, err := http.NewRequestWithContext(l.ctx, "GET", dep.URL, nil)
	if err != nil {
		logger.Log.Error().Err(err).Str("dependency", dep.Name).Msg("failed to create request")
		return fmt.Errorf("request error: %w", err)
	}

	// Set headers to mimic a browser and avoid rate limiting/drops
	req.Header.Set("User-Agent", "DownKingo-Launcher/2.0")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Connection", "keep-alive")

	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Log.Error().Err(err).Str("dependency", dep.Name).Msg("network error")
		return fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logger.Log.Error().Int("statusCode", resp.StatusCode).Str("dependency", dep.Name).Msg("HTTP error")
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	total := resp.ContentLength
	tempFile := filepath.Join(l.binDir, dep.FileName+".tmp")

	// Create temp file
	out, err := os.Create(tempFile)
	if err != nil {
		return err
	}

	// Download with progress tracking
	hasher := sha256.New()
	writer := io.MultiWriter(out, hasher)

	var downloaded int64
	buf := make([]byte, 32*1024) // 32KB buffer

	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			_, writeErr := writer.Write(buf[:n])
			if writeErr != nil {
				out.Close()
				os.Remove(tempFile)
				return writeErr
			}
			downloaded += int64(n)

			percent := float64(downloaded) / float64(total) * 100
			l.emitProgress(dep.Name, downloaded, total, percent, "downloading")
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			out.Close()
			os.Remove(tempFile)
			return err
		}
	}
	out.Close()

	// Verify checksum if provided
	if dep.SHA256 != "" {
		l.emitProgress(dep.Name, downloaded, total, 100, "verifying")
		actualHash := hex.EncodeToString(hasher.Sum(nil))
		if !strings.EqualFold(actualHash, dep.SHA256) {
			os.Remove(tempFile)
			return fmt.Errorf("checksum mismatch: expected %s, got %s", dep.SHA256, actualHash)
		}
	}

	// Handle archive extraction
	if dep.IsArchive {
		l.emitProgress(dep.Name, downloaded, total, 100, "extracting")
		var extractErr error
		switch dep.ArchiveType {
		case "zip":
			extractErr = l.extractFromZip(tempFile, dep.ExtractTargets)
		case "tar.xz", "tar.gz":
			extractErr = l.extractFromTarGz(tempFile, dep.ExtractTargets)
		}
		os.Remove(tempFile)
		if extractErr != nil {
			return extractErr
		}
	} else {
		// Move temp file to final location
		finalPath := filepath.Join(l.binDir, dep.FileName)
		if err := os.Rename(tempFile, finalPath); err != nil {
			return err
		}
		// Make executable on Unix
		if goruntime.GOOS != "windows" {
			os.Chmod(finalPath, 0755)
		}
	}

	l.emitProgress(dep.Name, downloaded, total, 100, "complete")
	return nil
}

// extractFromZip extracts specific files from a zip archive
func (l *Launcher) extractFromZip(zipPath string, targets []string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	foundCount := 0
	targetMap := make(map[string]bool)
	for _, t := range targets {
		targetMap[t] = true
	}

	for _, f := range r.File {
		baseName := filepath.Base(f.Name)

		// Verifique se o arquivo atual corresponde a algum dos targets
		if targetMap[baseName] {
			rc, err := f.Open()
			if err != nil {
				return err
			}

			// Extrai o arquivo
			outPath := filepath.Join(l.binDir, baseName)
			out, err := os.Create(outPath)
			if err != nil {
				rc.Close()
				return err
			}

			_, err = io.Copy(out, rc)
			out.Close()
			rc.Close()

			if err != nil {
				return err
			}

			// Make executable on Unix
			if goruntime.GOOS != "windows" {
				os.Chmod(outPath, 0755)
			}

			foundCount++
		}
	}

	if foundCount < len(targets) {
		return fmt.Errorf("alguns arquivos não foram encontrados no zip (encontrados: %d/%d)", foundCount, len(targets))
	}

	return nil
}

// extractFromTarGz extracts specific files from a tar.gz/tar.xz archive
func (l *Launcher) extractFromTarGz(archivePath string, targets []string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	var reader io.Reader = file

	// Handle gzip
	if strings.HasSuffix(archivePath, ".gz") {
		gzReader, err := gzip.NewReader(file)
		if err != nil {
			return err
		}
		defer gzReader.Close()
		reader = gzReader
	}

	// Note: For .xz we'd need a separate library, for now use .tar.gz builds
	// or shell out to xz command on the system

	tarReader := tar.NewReader(reader)

	targetMap := make(map[string]bool)
	for _, t := range targets {
		targetMap[t] = true
	}
	foundCount := 0

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		baseName := filepath.Base(header.Name)
		if targetMap[baseName] {
			outPath := filepath.Join(l.binDir, baseName)
			out, err := os.Create(outPath)
			if err != nil {
				return err
			}

			_, err = io.Copy(out, tarReader)
			out.Close()

			if err != nil {
				return err
			}

			// Make executable
			os.Chmod(outPath, 0755)

			foundCount++
		}
	}

	if foundCount < len(targets) {
		return fmt.Errorf("alguns arquivos não foram encontrados no archive (encontrados: %d/%d)", foundCount, len(targets))
	}

	return nil
}

// emitProgress emits download progress via Wails v3 events
func (l *Launcher) emitProgress(name string, downloaded, total int64, percent float64, status string) {
	l.emitEvent(events.LauncherProgress, DownloadProgress{
		Name:       name,
		Downloaded: downloaded,
		Total:      total,
		Percent:    percent,
		Status:     status,
	})
}

// emitEvent emits an event using Wails v2 API
func (l *Launcher) emitEvent(eventName string, data any) {
	if l.ctx != nil {
		wailsRuntime.EventsEmit(l.ctx, eventName, data)
	}
}

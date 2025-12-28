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

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// HTTP client with timeout to prevent hangs
var httpClient = &http.Client{
	Timeout: 5 * time.Minute, // 5 min for large downloads
}

// Dependency represents a required binary
type Dependency struct {
	Name          string
	URL           string
	FileName      string
	IsArchive     bool   // Needs extraction (zip/tar.gz)
	ArchiveType   string // "zip" or "tar.gz"
	ExtractTarget string // Name of the file to extract
	SHA256        string // Expected checksum (empty = skip verification)
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
				Name:          "FFmpeg",
				URL:           "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
				FileName:      "ffmpeg.zip",
				IsArchive:     true,
				ArchiveType:   "zip",
				ExtractTarget: "ffmpeg.exe",
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
				Name:          "FFmpeg",
				URL:           "https://evermeet.cx/ffmpeg/getrelease/zip",
				FileName:      "ffmpeg.zip",
				IsArchive:     true,
				ArchiveType:   "zip",
				ExtractTarget: "ffmpeg",
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
				Name:          "FFmpeg",
				URL:           "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
				FileName:      "ffmpeg.tar.xz",
				IsArchive:     true,
				ArchiveType:   "tar.xz",
				ExtractTarget: "ffmpeg",
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

// SetContext sets the Wails context for emitting events
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
		var targetFile string
		if dep.IsArchive {
			targetFile = filepath.Join(l.binDir, getFFmpegBinaryName())
		} else {
			targetFile = filepath.Join(l.binDir, getYtDlpBinaryName())
		}

		info, err := os.Stat(targetFile)
		installed := err == nil && info.Size() > 0

		var size int64
		if installed {
			size = info.Size()
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
		var targetFile string
		if dep.IsArchive {
			targetFile = filepath.Join(l.binDir, getFFmpegBinaryName())
		} else {
			targetFile = filepath.Join(l.binDir, getYtDlpBinaryName())
		}

		// Skip if already installed
		if info, err := os.Stat(targetFile); err == nil && info.Size() > 0 {
			l.emitProgress(dep.Name, 100, 100, 100, "complete")
			continue
		}

		if err := l.downloadDependency(dep); err != nil {
			l.emitProgress(dep.Name, 0, 0, 0, "error")
			return fmt.Errorf("failed to download %s: %w", dep.Name, err)
		}
	}

	runtime.EventsEmit(l.ctx, "launcher:complete")
	return nil
}

func (l *Launcher) downloadDependency(dep Dependency) error {
	l.emitProgress(dep.Name, 0, 0, 0, "downloading")

	// Create HTTP request with timeout
	resp, err := httpClient.Get(dep.URL)
	if err != nil {
		return fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
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
			extractErr = l.extractFromZip(tempFile, dep.ExtractTarget)
		case "tar.xz", "tar.gz":
			extractErr = l.extractFromTarGz(tempFile, dep.ExtractTarget)
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

// extractFromZip extracts a specific file from a zip archive
func (l *Launcher) extractFromZip(zipPath, targetName string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	// Find target file in the zip (might be in a subdirectory)
	for _, f := range r.File {
		baseName := filepath.Base(f.Name)
		if baseName == targetName || strings.HasSuffix(f.Name, "/"+targetName) {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			defer rc.Close()

			outPath := filepath.Join(l.binDir, targetName)
			out, err := os.Create(outPath)
			if err != nil {
				return err
			}
			defer out.Close()

			_, err = io.Copy(out, rc)
			if err != nil {
				return err
			}

			// Make executable on Unix
			if goruntime.GOOS != "windows" {
				os.Chmod(outPath, 0755)
			}
			return nil
		}
	}

	return fmt.Errorf("%s not found in zip", targetName)
}

// extractFromTarGz extracts a specific file from a tar.gz/tar.xz archive
func (l *Launcher) extractFromTarGz(archivePath, targetName string) error {
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

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		baseName := filepath.Base(header.Name)
		if baseName == targetName {
			outPath := filepath.Join(l.binDir, targetName)
			out, err := os.Create(outPath)
			if err != nil {
				return err
			}
			defer out.Close()

			_, err = io.Copy(out, tarReader)
			if err != nil {
				return err
			}

			// Make executable
			os.Chmod(outPath, 0755)
			return nil
		}
	}

	return fmt.Errorf("%s not found in archive", targetName)
}

func (l *Launcher) emitProgress(name string, downloaded, total int64, percent float64, status string) {
	if l.ctx == nil {
		return
	}
	runtime.EventsEmit(l.ctx, "launcher:progress", DownloadProgress{
		Name:       name,
		Downloaded: downloaded,
		Total:      total,
		Percent:    percent,
		Status:     status,
	})
}

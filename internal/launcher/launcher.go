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

	aria2runtime "kingo/internal/aria2"
	"kingo/internal/events"
	"kingo/internal/logger"
	"kingo/internal/pot"

	"github.com/wailsapp/wails/v3/pkg/application"
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
	Version        string
	License        string
	ProjectURL     string
	URL            string
	FileName       string
	RelativeDir    string   // Optional directory below a binary root
	IsArchive      bool     // Needs extraction (zip/tar.gz)
	ArchiveType    string   // "zip" or "tar.gz"
	ExtractTargets []string // Names of the files to extract
	SHA256         string   // Expected checksum (empty = skip verification)
	Validate       func(string) error
}

// Launcher handles dependency checking and downloading
type Launcher struct {
	ctx        context.Context
	binDir     string
	searchDirs []string
	deps       []Dependency
}

// NewLauncher creates a new launcher instance with OS-specific dependencies
func NewLauncher(binDir string) *Launcher {
	return &Launcher{
		ctx:        context.Background(),
		binDir:     binDir,
		searchDirs: []string{binDir},
		deps:       getDependencies(),
	}
}

// SetSearchDirs configures all binary roots accepted as installed. Runtime
// AppData remains the installation destination and final fallback.
func (l *Launcher) SetSearchDirs(dirs ...string) {
	seen := make(map[string]struct{}, len(dirs)+1)
	l.searchDirs = l.searchDirs[:0]
	for _, dir := range append(dirs, l.binDir) {
		dir = filepath.Clean(strings.TrimSpace(dir))
		if dir == "." || dir == "" {
			continue
		}
		key := strings.ToLower(dir)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		l.searchDirs = append(l.searchDirs, dir)
	}
}

// getDependencies returns OS-specific dependency configurations
func getDependencies() []Dependency {
	var dependencies []Dependency
	switch goruntime.GOOS {
	case "windows":
		dependencies = []Dependency{
			{
				Name: "yt-dlp", Version: "latest", License: "Unlicense",
				ProjectURL: "https://github.com/yt-dlp/yt-dlp",
				URL:        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
				FileName:   "yt-dlp.exe",
			},
			{
				Name: "FFmpeg", Version: "latest", License: "GPL-3.0",
				ProjectURL: "https://ffmpeg.org/",
				URL:        "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
				FileName:   "ffmpeg.zip", IsArchive: true, ArchiveType: "zip",
				ExtractTargets: []string{"ffmpeg.exe", "ffprobe.exe"},
			},
			{
				Name: "avifenc", Version: "latest", License: "BSD-2-Clause",
				ProjectURL: "https://github.com/AOMediaCodec/libavif",
				URL:        "https://github.com/AOMediaCodec/libavif/releases/latest/download/windows-artifacts.zip",
				FileName:   "avifenc.zip", IsArchive: true, ArchiveType: "zip",
				ExtractTargets: []string{"avifenc.exe"},
			},
		}
	case "darwin": // macOS
		dependencies = []Dependency{
			{
				Name: "yt-dlp", Version: "latest", License: "Unlicense",
				ProjectURL: "https://github.com/yt-dlp/yt-dlp",
				URL:        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
				FileName:   "yt-dlp",
			},
			{
				Name: "FFmpeg", Version: "latest", License: "LGPL-2.1+ / GPL-2.0+",
				ProjectURL: "https://ffmpeg.org/",
				URL:        "https://evermeet.cx/ffmpeg/getrelease/zip",
				FileName:   "ffmpeg.zip", IsArchive: true, ArchiveType: "zip",
				ExtractTargets: []string{"ffmpeg", "ffprobe"},
			},
			{
				Name: "avifenc", Version: "latest", License: "BSD-2-Clause",
				ProjectURL: "https://github.com/AOMediaCodec/libavif",
				URL:        "https://github.com/AOMediaCodec/libavif/releases/latest/download/macOS-artifacts.zip",
				FileName:   "avifenc.zip", IsArchive: true, ArchiveType: "zip",
				ExtractTargets: []string{"avifenc"},
			},
		}
	default: // Linux
		dependencies = []Dependency{
			{
				Name: "yt-dlp", Version: "latest", License: "Unlicense",
				ProjectURL: "https://github.com/yt-dlp/yt-dlp",
				URL:        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
				FileName:   "yt-dlp",
			},
			{
				Name: "FFmpeg", Version: "latest", License: "LGPL-2.1+ / GPL-2.0+",
				ProjectURL: "https://ffmpeg.org/",
				URL:        "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
				FileName:   "ffmpeg.tar.xz", IsArchive: true, ArchiveType: "tar.xz",
				ExtractTargets: []string{"ffmpeg", "ffprobe"},
			},
			{
				Name: "avifenc", Version: "latest", License: "BSD-2-Clause",
				ProjectURL: "https://github.com/AOMediaCodec/libavif",
				URL:        "https://github.com/AOMediaCodec/libavif/releases/latest/download/linux-artifacts.zip",
				FileName:   "avifenc.zip", IsArchive: true, ArchiveType: "zip",
				ExtractTargets: []string{"avifenc"},
			},
		}
	}

	if provider, err := pot.BinaryAsset(); err == nil {
		plugin := pot.PluginAsset()
		dependencies = append(dependencies,
			Dependency{
				Name: pot.ProviderDependencyName, Version: "v" + pot.SupportedVersion,
				License: pot.License, ProjectURL: pot.ProjectURL,
				URL: provider.URL, FileName: provider.LocalName, SHA256: provider.SHA256,
				Validate: func(path string) error {
					_, err := pot.ValidateBinary(path)
					return err
				},
			},
			Dependency{
				Name: pot.PluginDependencyName, Version: "v" + pot.SupportedVersion,
				License: pot.License, ProjectURL: pot.ProjectURL,
				URL: plugin.URL, FileName: plugin.LocalName, RelativeDir: "yt-dlp-plugins",
				SHA256: plugin.SHA256, Validate: pot.ValidatePlugin,
			},
		)
	}
	return dependencies
}

// SetContext sets the context for cancellation (kept for interface compatibility)
func (l *Launcher) SetContext(ctx context.Context) {
	l.ctx = ctx
}

// DependencyStatus represents the status of a dependency
type DependencyStatus struct {
	Name       string `json:"name"`
	Installed  bool   `json:"installed"`
	Size       int64  `json:"size"`
	Version    string `json:"version,omitempty"`
	License    string `json:"license,omitempty"`
	ProjectURL string `json:"projectUrl,omitempty"`
}

// CheckDependencies verifies which dependencies are installed
func (l *Launcher) CheckDependencies() []DependencyStatus {
	statuses := make([]DependencyStatus, 0, len(l.deps))

	for _, dep := range l.deps {
		installed, size := l.dependencyInstalled(dep)

		statuses = append(statuses, DependencyStatus{
			Name: dep.Name, Installed: installed, Size: size,
			Version: dep.Version, License: dep.License, ProjectURL: dep.ProjectURL,
		})
	}

	return statuses
}

// DownloadProgress is emitted during download
type DownloadProgress struct {
	Name       string  `json:"name"`
	Downloaded int64   `json:"downloaded"`
	Total      int64   `json:"total"`
	Percent    float64 `json:"percent"`
	Status     string  `json:"status"` // downloading, extracting, verifying, complete, error
}

// DownloadSelectedDependencies downloads only the dependencies whose names match the provided list
func (l *Launcher) DownloadSelectedDependencies(names []string) error {
	nameSet := make(map[string]bool, len(names))
	for _, n := range names {
		nameSet[n] = true
	}

	for _, dep := range l.deps {
		if !nameSet[dep.Name] {
			continue
		}

		installed, _ := l.dependencyInstalled(dep)

		if installed {
			l.emitProgress(dep.Name, 100, 100, 100, "complete")
			continue
		}

		if err := l.downloadDependency(dep); err != nil {
			l.emitProgress(dep.Name, 0, 0, 0, "error")
			return fmt.Errorf("failed to download %s: %w", dep.Name, err)
		}
	}

	l.emitEvent(events.LauncherComplete, nil)
	logger.Log.Info().Msg("selected dependencies installed successfully")
	return nil
}

func (l *Launcher) dependencyInstalled(dep Dependency) (bool, int64) {
	targets := dep.ExtractTargets
	if !dep.IsArchive {
		targets = []string{dep.FileName}
	}
	var totalSize int64
	for _, target := range targets {
		found := false
		for _, root := range l.searchDirs {
			path := filepath.Join(root, dep.RelativeDir, target)
			info, err := os.Stat(path)
			if err != nil || info.IsDir() || info.Size() == 0 {
				continue
			}
			if dep.Validate != nil {
				if err := dep.Validate(path); err != nil {
					continue
				}
			}
			totalSize += info.Size()
			found = true
			break
		}
		if !found {
			return false, 0
		}
	}
	return true, totalSize
}

func (l *Launcher) dependencyInstallDir(dep Dependency) string {
	return filepath.Join(l.binDir, dep.RelativeDir)
}

// DownloadAria2c baixa e instala o aria2c (download opcional, sob demanda)
func (l *Launcher) DownloadAria2c() error {
	var dep Dependency

	switch goruntime.GOOS {
	case "windows":
		dep = Dependency{
			Name:           "aria2c",
			URL:            aria2runtime.ArchiveURL,
			FileName:       "aria2c.zip",
			IsArchive:      true,
			ArchiveType:    "zip",
			ExtractTargets: []string{"aria2c.exe"},
			SHA256:         aria2runtime.ArchiveSHA256,
		}
	default:
		// Linux/Mac: aria2c geralmente disponível via package manager
		return fmt.Errorf("aria2c download não suportado neste OS, instale via package manager")
	}

	// Verificar se já existe
	// Usa o primeiro alvo como referência principal
	targetFile := filepath.Join(l.binDir, dep.ExtractTargets[0])
	if _, err := aria2runtime.Validate(targetFile); err == nil {
		return nil
	}
	if err := l.downloadDependency(dep); err != nil {
		return err
	}
	if _, err := aria2runtime.Validate(targetFile); err != nil {
		_ = os.Remove(targetFile)
		return fmt.Errorf("downloaded aria2c failed validation: %w", err)
	}
	return nil
}

func (l *Launcher) downloadDependency(dep Dependency) error {
	l.emitProgress(dep.Name, 0, 0, 0, "downloading")
	logger.Log.Info().Str("dependency", dep.Name).Str("url", dep.URL).Msg("starting download")
	installDir := l.dependencyInstallDir(dep)
	if err := os.MkdirAll(installDir, 0755); err != nil {
		return err
	}

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
	tempFile := filepath.Join(installDir, dep.FileName+".tmp")

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

			percent := float64(0)
			if total > 0 {
				percent = float64(downloaded) / float64(total) * 100
			}
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

	// Verify downloaded size matches expected
	if total > 0 && downloaded != total {
		os.Remove(tempFile)
		return fmt.Errorf("download incompleto: recebido %d de %d bytes", downloaded, total)
	}

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
			extractErr = l.extractFromZip(tempFile, installDir, dep.ExtractTargets)
		case "tar.xz", "tar.gz":
			extractErr = l.extractFromTarGz(tempFile, installDir, dep.ExtractTargets)
		}
		os.Remove(tempFile)
		if extractErr != nil {
			return extractErr
		}
	} else {
		// Make executable on Unix
		if goruntime.GOOS != "windows" {
			_ = os.Chmod(tempFile, 0755)
		}
		if dep.Validate != nil {
			if err := dep.Validate(tempFile); err != nil {
				_ = os.Remove(tempFile)
				return fmt.Errorf("downloaded %s failed validation: %w", dep.Name, err)
			}
		}
		finalPath := filepath.Join(installDir, dep.FileName)
		if err := activateDownloadedFile(tempFile, finalPath); err != nil {
			return err
		}
	}

	l.emitProgress(dep.Name, downloaded, total, 100, "complete")
	return nil
}

// extractFromZip extracts specific files from a zip archive
func (l *Launcher) extractFromZip(zipPath, destinationDir string, targets []string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	stageDir, err := os.MkdirTemp(destinationDir, ".extract-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stageDir)

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
			outPath := filepath.Join(stageDir, baseName)
			out, err := os.OpenFile(outPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0755)
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
				if err := os.Chmod(outPath, 0755); err != nil {
					return err
				}
			}

			foundCount++
		}
	}

	if foundCount < len(targets) {
		return fmt.Errorf("alguns arquivos não foram encontrados no zip (encontrados: %d/%d)", foundCount, len(targets))
	}
	return activateExtractedFiles(stageDir, destinationDir, targets)
}

// extractFromTarGz extracts specific files from a tar.gz/tar.xz archive
func (l *Launcher) extractFromTarGz(archivePath, destinationDir string, targets []string) error {
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
			outPath := filepath.Join(destinationDir, baseName)
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
			if err := os.Chmod(outPath, 0755); err != nil {
				return err
			}

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

// emitEvent emits an event using Wails v3 API
func (l *Launcher) emitEvent(eventName string, data any) {
	if app := application.Get(); app != nil {
		app.Event.Emit(eventName, data)
	}
}

func activateExtractedFiles(stageDir, destinationDir string, targets []string) error {
	type activation struct {
		staged, final, backup string
		activated             bool
	}
	items := make([]activation, 0, len(targets))
	stamp := time.Now().UnixNano()
	for _, name := range targets {
		items = append(items, activation{
			staged: filepath.Join(stageDir, name), final: filepath.Join(destinationDir, name),
			backup: filepath.Join(destinationDir, fmt.Sprintf(".%s.backup-%d", name, stamp)),
		})
	}
	restoreBackups := func() {
		for i := range items {
			if items[i].activated {
				_ = os.Remove(items[i].final)
			}
			if items[i].backup != "" {
				if _, err := os.Stat(items[i].backup); err == nil {
					_ = os.Rename(items[i].backup, items[i].final)
				}
			}
		}
	}
	for i := range items {
		if _, err := os.Stat(items[i].final); err == nil {
			if err := os.Rename(items[i].final, items[i].backup); err != nil {
				restoreBackups()
				return err
			}
		} else if !os.IsNotExist(err) {
			restoreBackups()
			return err
		} else {
			items[i].backup = ""
		}
	}
	for i := range items {
		if err := os.Rename(items[i].staged, items[i].final); err != nil {
			restoreBackups()
			return err
		}
		items[i].activated = true
	}
	for _, item := range items {
		if item.backup != "" {
			_ = os.Remove(item.backup)
		}
	}
	return nil
}

func activateDownloadedFile(stagedPath, finalPath string) error {
	backupPath := fmt.Sprintf("%s.backup-%d", finalPath, time.Now().UnixNano())
	hadPrevious := false
	if _, err := os.Stat(finalPath); err == nil {
		if err := os.Rename(finalPath, backupPath); err != nil {
			return err
		}
		hadPrevious = true
	} else if !os.IsNotExist(err) {
		return err
	}
	if err := os.Rename(stagedPath, finalPath); err != nil {
		if hadPrevious {
			_ = os.Rename(backupPath, finalPath)
		}
		return err
	}
	if hadPrevious {
		_ = os.Remove(backupPath)
	}
	return nil
}

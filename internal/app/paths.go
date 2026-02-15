package app

import (
	"os"
	"path/filepath"
	"runtime"
)

// DevMode is set at build time via ldflags to isolate dev environment from production.
// When true, uses "DownKingo-dev" directory instead of "DownKingo".
// Example: -ldflags "-X 'kingo/internal/app.DevMode=true'"
var DevMode string = "false"

// getAppDirName returns the app directory name based on build mode
func getAppDirName() string {
	if DevMode == "true" {
		return "DownKingo-dev"
	}
	return "DownKingo"
}

// Paths holds all application directory paths
type Paths struct {
	AppData   string // %AppData%/DownKingo (config, deps)
	Bin       string // %AppData%/DownKingo/bin (yt-dlp, ffmpeg) - fallback
	Downloads string // ~/Videos/DownKingo (Default for videos)
	Images    string // ~/Pictures/DownKingo (Default for images)
	ExeDir    string // Directory where the executable is located (for sidecar binaries)
}

// GetPaths returns the application paths based on OS
func GetPaths() (*Paths, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	appData := filepath.Join(configDir, getAppDirName())
	bin := filepath.Join(appData, "bin")

	// Get the directory where the executable is located (for sidecar detection)
	exePath, err := os.Executable()
	if err != nil {
		return nil, err
	}
	exeDir := filepath.Dir(exePath)

	// Downloads: Videos/DownKingo on Windows, Movies/DownKingo on Mac
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	var downloads string
	var images string

	switch runtime.GOOS {
	case "windows":
		downloads = filepath.Join(homeDir, "Videos", "DownKingo")
		images = filepath.Join(homeDir, "Pictures", "DownKingo")
	case "darwin":
		downloads = filepath.Join(homeDir, "Movies", "DownKingo")
		images = filepath.Join(homeDir, "Pictures", "DownKingo")
	default:
		downloads = filepath.Join(homeDir, "Videos", "DownKingo")
		images = filepath.Join(homeDir, "Pictures", "DownKingo")
	}

	return &Paths{
		AppData:   appData,
		Bin:       bin,
		Downloads: downloads,
		Images:    images,
		ExeDir:    exeDir,
	}, nil
}

// EnsureDirectories creates all required directories
func (p *Paths) EnsureDirectories() error {
	dirs := []string{p.AppData, p.Bin, p.Downloads, p.Images}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

// getSidecarPaths returns all possible sidecar locations for the current OS.
// Returns paths in priority order (first match wins).
//
// Sidecar binaries are pre-bundled executables that ship with the installer:
//   - Windows NSIS: Binaries are in ExeDir/bin/ (e.g., C:\Program Files\DownKingo\bin\ffmpeg.exe)
//   - macOS App Bundle: Binaries are in .app/Contents/Resources/bin/
//     The executable is in .app/Contents/MacOS/, so we go up two levels to Resources
//   - Linux AppImage: Binaries are in the same directory as the executable (usr/bin/)
func (p *Paths) getSidecarPaths(binaryName string) []string {
	var paths []string

	switch runtime.GOOS {
	case "windows":
		// Windows NSIS: Binários em ExeDir/bin/
		paths = append(paths, filepath.Join(p.ExeDir, "bin", binaryName))

	case "darwin":
		// macOS App Bundle: Binários em .app/Contents/Resources/bin/
		// O executável fica em .app/Contents/MacOS/, então subimos dois níveis
		resourcesDir := filepath.Join(p.ExeDir, "..", "Resources", "bin")
		paths = append(paths, filepath.Join(resourcesDir, binaryName))
		// Fallback: ao lado do executável (dev mode)
		paths = append(paths, filepath.Join(p.ExeDir, binaryName))

	default: // Linux
		// AppImage: Binários no mesmo diretório do executável (usr/bin/)
		paths = append(paths, filepath.Join(p.ExeDir, binaryName))
		// Fallback: subdiretório bin
		paths = append(paths, filepath.Join(p.ExeDir, "bin", binaryName))
	}

	return paths
}

// getBinaryPath returns the path to a binary, checking sidecar locations first
func (p *Paths) getBinaryPath(binaryName string) string {
	// Priority 1: Sidecar (binários empacotados no instalador/bundle/AppImage)
	for _, sidecarPath := range p.getSidecarPaths(binaryName) {
		if fileExists(sidecarPath) {
			return sidecarPath
		}
	}

	// Priority 2: AppData (binários baixados em runtime - fallback)
	return filepath.Join(p.Bin, binaryName)
}

// fileExists verifica se um arquivo existe e tem tamanho > 0
func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir() && info.Size() > 0
}

// YtDlpPath returns the full path to yt-dlp executable
// Checks sidecar location first, then AppData
func (p *Paths) YtDlpPath() string {
	if runtime.GOOS == "windows" {
		return p.getBinaryPath("yt-dlp.exe")
	}
	return p.getBinaryPath("yt-dlp")
}

// FFmpegPath returns the full path to ffmpeg executable
// Checks sidecar location first, then AppData
func (p *Paths) FFmpegPath() string {
	if runtime.GOOS == "windows" {
		return p.getBinaryPath("ffmpeg.exe")
	}
	return p.getBinaryPath("ffmpeg")
}

// Aria2cPath returns the full path to aria2c executable (optional)
// Checks sidecar location first, then AppData
func (p *Paths) Aria2cPath() string {
	if runtime.GOOS == "windows" {
		return p.getBinaryPath("aria2c.exe")
	}
	return p.getBinaryPath("aria2c")
}

// WhisperDir returns the directory for whisper.cpp binary and models
func (p *Paths) WhisperDir() string {
	return filepath.Join(p.AppData, "whisper")
}

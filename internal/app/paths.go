package app

import (
	"os"
	"path/filepath"
	"runtime"

	"kingo/internal/pot"
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

	appName := getAppDirName()
	switch runtime.GOOS {
	case "windows":
		downloads = filepath.Join(homeDir, "Videos", appName)
		images = filepath.Join(homeDir, "Pictures", appName)
	case "darwin":
		downloads = filepath.Join(homeDir, "Movies", appName)
		images = filepath.Join(homeDir, "Pictures", appName)
	default:
		downloads = filepath.Join(homeDir, "Videos", appName)
		images = filepath.Join(homeDir, "Pictures", appName)
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
	dirs := []string{p.AppData, p.Bin, p.Downloads, p.Images, p.POTCacheDir()}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

// sidecarBinDirs returns the platform-specific directories that may contain
// binaries shipped with the desktop installer.
func (p *Paths) sidecarBinDirs() []string {
	switch runtime.GOOS {
	case "windows":
		return []string{filepath.Join(p.ExeDir, "bin")}
	case "darwin":
		return []string{
			filepath.Join(p.ExeDir, "..", "Resources", "bin"),
			p.ExeDir,
		}
	default:
		return []string{p.ExeDir, filepath.Join(p.ExeDir, "bin")}
	}
}

// BinarySearchDirs returns binary roots in discovery priority order. The
// launcher uses the same list as runtime path resolution, preventing bundled
// sidecars from being downloaded a second time into AppData.
func (p *Paths) BinarySearchDirs() []string {
	dirs := append([]string{}, p.sidecarBinDirs()...)
	return append(dirs, p.Bin)
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
	paths := make([]string, 0, len(p.sidecarBinDirs()))
	for _, dir := range p.sidecarBinDirs() {
		paths = append(paths, filepath.Join(dir, binaryName))
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

// AvifencPath returns the full path to avifenc executable
// Checks sidecar location first, then AppData
func (p *Paths) AvifencPath() string {
	if runtime.GOOS == "windows" {
		return p.getBinaryPath("avifenc.exe")
	}
	return p.getBinaryPath("avifenc")
}

// POTProviderPath returns the managed Rust provider executable.
func (p *Paths) POTProviderPath() string {
	asset, err := pot.BinaryAsset()
	if err != nil {
		if runtime.GOOS == "windows" {
			return p.getBinaryPath("bgutil-pot.exe")
		}
		return p.getBinaryPath("bgutil-pot")
	}
	return p.getBinaryPath(asset.LocalName)
}

// POTPluginPath returns the verified plugin archive paired with the provider.
func (p *Paths) POTPluginPath() string {
	for _, root := range p.BinarySearchDirs() {
		candidate := filepath.Join(root, "yt-dlp-plugins", pot.PluginFileName)
		if fileExists(candidate) {
			return candidate
		}
	}
	return filepath.Join(p.Bin, "yt-dlp-plugins", pot.PluginFileName)
}

// POTCacheDir isolates provider cache data inside DownKingo's application data.
func (p *Paths) POTCacheDir() string {
	return filepath.Join(p.AppData, "pot-cache")
}

// WhisperDir returns the directory for whisper.cpp binary and models
func (p *Paths) WhisperDir() string {
	return filepath.Join(p.AppData, "whisper")
}

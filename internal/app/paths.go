package app

import (
	"os"
	"path/filepath"
	"runtime"
)

// Paths holds all application directory paths
type Paths struct {
	AppData   string // %AppData%/Kinematic (config, deps)
	Bin       string // %AppData%/Kinematic/bin (yt-dlp, ffmpeg) - fallback
	Downloads string // ~/Videos/Kinematic
	ExeDir    string // Directory where the executable is located (for sidecar binaries)
}

// GetPaths returns the application paths based on OS
func GetPaths() (*Paths, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	appData := filepath.Join(configDir, "Kinematic")
	bin := filepath.Join(appData, "bin")

	// Get the directory where the executable is located (for sidecar detection)
	exePath, err := os.Executable()
	if err != nil {
		return nil, err
	}
	exeDir := filepath.Dir(exePath)

	// Downloads: Videos/Kinematic on Windows, Movies/Kinematic on Mac
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	var downloads string
	switch runtime.GOOS {
	case "windows":
		downloads = filepath.Join(homeDir, "Videos", "Kinematic")
	case "darwin":
		downloads = filepath.Join(homeDir, "Movies", "Kinematic")
	default:
		downloads = filepath.Join(homeDir, "Videos", "Kinematic")
	}

	return &Paths{
		AppData:   appData,
		Bin:       bin,
		Downloads: downloads,
		ExeDir:    exeDir,
	}, nil
}

// EnsureDirectories creates all required directories
func (p *Paths) EnsureDirectories() error {
	dirs := []string{p.AppData, p.Bin, p.Downloads}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

// getSidecarPaths returns all possible sidecar locations for the current OS
// Returns paths in priority order (first match wins)
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

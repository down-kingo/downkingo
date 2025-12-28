package app

import (
	"os"
	"path/filepath"
	"runtime"
)

// Paths holds all application directory paths
type Paths struct {
	AppData   string // %AppData%/Kinematic (config, deps)
	Bin       string // %AppData%/Kinematic/bin (yt-dlp, ffmpeg)
	Downloads string // ~/Videos/Kinematic
}

// GetPaths returns the application paths based on OS
func GetPaths() (*Paths, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	appData := filepath.Join(configDir, "Kinematic")
	bin := filepath.Join(appData, "bin")

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

// YtDlpPath returns the full path to yt-dlp executable
func (p *Paths) YtDlpPath() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(p.Bin, "yt-dlp.exe")
	}
	return filepath.Join(p.Bin, "yt-dlp")
}

// FFmpegPath returns the full path to ffmpeg executable
func (p *Paths) FFmpegPath() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(p.Bin, "ffmpeg.exe")
	}
	return filepath.Join(p.Bin, "ffmpeg")
}

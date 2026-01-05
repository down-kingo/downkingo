package handlers

import (
	"context"
	"kingo/internal/app"
	"kingo/internal/launcher"
	"kingo/internal/updater"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strings"
)

// Aria2cStatus retorna informações sobre o aria2c.
type Aria2cStatus struct {
	Installed bool   `json:"installed"`
	Path      string `json:"path"`
	Version   string `json:"version"`
}

// SystemHandler encapsulates all system-related operations.
type SystemHandler struct {
	ctx            context.Context
	paths          *app.Paths
	launcher       *launcher.Launcher
	updater        *updater.Updater
	consoleEmitter func(string)
}

// NewSystemHandler creates a new SystemHandler with dependencies.
func NewSystemHandler(paths *app.Paths, l *launcher.Launcher, u *updater.Updater) *SystemHandler {
	return &SystemHandler{
		ctx:            context.Background(),
		paths:          paths,
		launcher:       l,
		updater:        u,
		consoleEmitter: func(s string) {},
	}
}

// SetContext sets the Wails runtime context.
func (h *SystemHandler) SetContext(ctx context.Context) {
	h.ctx = ctx
}

// SetConsoleEmitter sets the function to emit user-friendly console logs.
func (h *SystemHandler) SetConsoleEmitter(emitter func(string)) {
	h.consoleEmitter = emitter
}

func (h *SystemHandler) consoleLog(message string) {
	if h.consoleEmitter != nil {
		h.consoleEmitter(message)
	}
}

// === Launcher/Dependencies ===

// CheckDependencies returns the status of all dependencies.
func (h *SystemHandler) CheckDependencies() []launcher.DependencyStatus {
	return h.launcher.CheckDependencies()
}

// NeedsDependencies returns true if any dependency is missing.
func (h *SystemHandler) NeedsDependencies() bool {
	return h.launcher.NeedsDependencies()
}

// DownloadDependencies downloads all missing dependencies.
func (h *SystemHandler) DownloadDependencies() error {
	h.consoleLog("[Sistema] Baixando dependências necessárias...")
	err := h.launcher.DownloadDependencies()
	if err == nil {
		h.consoleLog("[Sistema] Dependências instaladas com sucesso!")
	} else {
		h.consoleLog("[Sistema] Erro ao instalar dependências")
	}
	return err
}

// === Aria2c Management ===

// CheckAria2cStatus verifica se aria2c está instalado.
func (h *SystemHandler) CheckAria2cStatus() Aria2cStatus {
	path := h.paths.Aria2cPath()
	if path == "" {
		return Aria2cStatus{Installed: false}
	}

	info, err := os.Stat(path)
	if err != nil || info.IsDir() || info.Size() == 0 {
		return Aria2cStatus{
			Installed: false,
			Path:      path,
		}
	}

	// Get actual version from binary
	version := "unknown"
	cmd := exec.Command(path, "--version")
	if output, err := cmd.Output(); err == nil {
		lines := strings.Split(string(output), "\n")
		if len(lines) > 0 {
			// First line is "aria2 version X.X.X"
			parts := strings.Fields(lines[0])
			if len(parts) >= 3 {
				version = parts[2]
			}
		}
	}

	return Aria2cStatus{
		Installed: true,
		Path:      path,
		Version:   version,
	}
}

// DownloadAria2c baixa e instala o aria2c.
func (h *SystemHandler) DownloadAria2c() error {
	return h.launcher.DownloadAria2c()
}

// DeleteAria2c remove o aria2c e arquivos relacionados.
func (h *SystemHandler) DeleteAria2c() error {
	path := h.paths.Aria2cPath()
	if path != "" {
		os.Remove(path)
	}

	binDir := h.paths.Bin
	patterns := []string{"aria2c*", "COPYING*"}

	for _, pattern := range patterns {
		matches, err := filepath.Glob(filepath.Join(binDir, pattern))
		if err == nil {
			for _, match := range matches {
				os.Remove(match)
			}
		}
	}

	return nil
}

// === Rembg Management (IA Background Removal) ===

// CheckRembgStatus verifica se o rembg está instalado.
func (h *SystemHandler) CheckRembgStatus() launcher.RembgStatus {
	return h.launcher.CheckRembgStatus()
}

// DownloadRembg baixa e instala o rembg (ferramenta de IA para remoção de fundo).
func (h *SystemHandler) DownloadRembg() error {
	h.consoleLog("[Sistema] Baixando e instalando rembg (IA para remoção de fundo)...")
	err := h.launcher.DownloadRembg()
	if err == nil {
		h.consoleLog("[Sistema] Rembg instalado com sucesso!")
	} else {
		h.consoleLog("[Sistema] Erro ao instalar rembg: " + err.Error())
	}
	return err
}

// DeleteRembg remove a instalação do rembg.
func (h *SystemHandler) DeleteRembg() error {
	h.consoleLog("[Sistema] Removendo rembg...")
	return h.launcher.DeleteRembg()
}

// === Updater ===

// CheckForUpdate checks GitHub for a newer release.
func (h *SystemHandler) CheckForUpdate() (*updater.UpdateInfo, error) {
	return h.updater.CheckForUpdate()
}

// GetAvailableAppVersions returns all releases.
func (h *SystemHandler) GetAvailableAppVersions() ([]updater.Release, error) {
	return h.updater.GetAvailableReleases()
}

// InstallAppVersion installs a specific app version.
func (h *SystemHandler) InstallAppVersion(tag string) error {
	return h.updater.InstallVersion(tag)
}

// DownloadAndApplyUpdate downloads and installs an update.
func (h *SystemHandler) DownloadAndApplyUpdate(downloadURL string) error {
	return h.updater.DownloadAndApply(downloadURL)
}

// RestartApp restarts the application.
func (h *SystemHandler) RestartApp() {
	h.updater.RestartApp()
}

// === Utilities ===

// OpenPath opens a file or folder in the system file manager.
func (h *SystemHandler) OpenPath(path string, selectFile bool) error {
	var cmd *exec.Cmd

	switch goruntime.GOOS {
	case "windows":
		path = strings.ReplaceAll(path, "/", "\\")
		if selectFile {
			cmd = exec.Command("explorer", "/select,", path)
		} else {
			cmd = exec.Command("explorer", path)
		}
	case "darwin":
		if selectFile {
			cmd = exec.Command("open", "-R", path)
		} else {
			cmd = exec.Command("open", path)
		}
	default: // Linux
		if selectFile {
			cmd = exec.Command("xdg-open", filepath.Dir(path))
		} else {
			cmd = exec.Command("xdg-open", path)
		}
	}

	return cmd.Start()
}

// GetVersion returns the current app version.
func (h *SystemHandler) GetVersion(version string) string {
	return version
}

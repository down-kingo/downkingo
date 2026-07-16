package launcher

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	aria2runtime "kingo/internal/aria2"
)

func TestActivateExtractedFilesReplacesAtomically(t *testing.T) {
	destination := t.TempDir()
	stage := t.TempDir()
	name := "aria2c.exe"
	if err := os.WriteFile(filepath.Join(destination, name), []byte("old"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stage, name), []byte("new"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := activateExtractedFiles(stage, destination, []string{name}); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(destination, name))
	if err != nil || string(data) != "new" {
		t.Fatalf("activated file = %q, err=%v", data, err)
	}
	backups, _ := filepath.Glob(filepath.Join(destination, ".*.backup-*"))
	if len(backups) != 0 {
		t.Fatalf("unexpected backup files: %v", backups)
	}
}

func TestDownloadPinnedAria2Integration(t *testing.T) {
	if os.Getenv("DOWNKINGO_ARIA2_INTEGRATION") != "1" {
		t.Skip("set DOWNKINGO_ARIA2_INTEGRATION=1 to verify the pinned aria2c release")
	}
	launcher := NewLauncher(t.TempDir())
	launcher.SetContext(context.Background())
	if err := launcher.DownloadAria2c(); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(launcher.binDir, "aria2c.exe")
	version, err := aria2runtime.Validate(path)
	if err != nil || version != aria2runtime.SupportedVersion {
		t.Fatalf("installed aria2c validation failed: version=%q err=%v", version, err)
	}
}

func TestDependencyDiscoveryUsesConfiguredSidecarRoots(t *testing.T) {
	runtimeDir := t.TempDir()
	sidecarDir := t.TempDir()
	launcher := NewLauncher(runtimeDir)
	launcher.SetSearchDirs(sidecarDir)

	dep := Dependency{Name: "tool", FileName: "tool.exe"}
	if err := os.WriteFile(filepath.Join(sidecarDir, dep.FileName), []byte("sidecar"), 0600); err != nil {
		t.Fatal(err)
	}
	installed, size := launcher.dependencyInstalled(dep)
	if !installed || size != int64(len("sidecar")) {
		t.Fatalf("sidecar discovery = installed %v, size %d", installed, size)
	}
}

func TestDependencyDiscoverySupportsManagedPluginDirectory(t *testing.T) {
	runtimeDir := t.TempDir()
	launcher := NewLauncher(runtimeDir)
	dep := Dependency{Name: "plugin", FileName: "plugin.zip", RelativeDir: "yt-dlp-plugins"}
	pluginDir := filepath.Join(runtimeDir, dep.RelativeDir)
	if err := os.MkdirAll(pluginDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(pluginDir, dep.FileName), []byte("plugin"), 0600); err != nil {
		t.Fatal(err)
	}
	installed, _ := launcher.dependencyInstalled(dep)
	if !installed {
		t.Fatal("managed plugin directory was not discovered")
	}
}

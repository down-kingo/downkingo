package launcher

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"kingo/internal/pot"
)

func TestDownloadPinnedPOProviderIntegration(t *testing.T) {
	if os.Getenv("DOWNKINGO_POT_DOWNLOAD_INTEGRATION") != "1" {
		t.Skip("set DOWNKINGO_POT_DOWNLOAD_INTEGRATION=1 to verify the pinned provider release")
	}
	dir := t.TempDir()
	launcher := NewLauncher(dir)
	launcher.SetContext(context.Background())
	if err := launcher.DownloadSelectedDependencies([]string{
		pot.ProviderDependencyName,
		pot.PluginDependencyName,
	}); err != nil {
		t.Fatal(err)
	}
	asset, err := pot.BinaryAsset()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pot.ValidateBinary(filepath.Join(dir, asset.LocalName)); err != nil {
		t.Fatal(err)
	}
	if err := pot.ValidatePlugin(filepath.Join(dir, "yt-dlp-plugins", pot.PluginFileName)); err != nil {
		t.Fatal(err)
	}
}

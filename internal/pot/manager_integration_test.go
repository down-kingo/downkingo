package pot

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPinnedProviderManagerIntegration(t *testing.T) {
	if os.Getenv("DOWNKINGO_POT_INTEGRATION") != "1" {
		t.Skip("set DOWNKINGO_POT_INTEGRATION=1 and the provider paths to test the real sidecar")
	}
	binaryPath := os.Getenv("DOWNKINGO_POT_BINARY")
	pluginPath := os.Getenv("DOWNKINGO_POT_PLUGIN")
	if binaryPath == "" || pluginPath == "" {
		t.Fatal("DOWNKINGO_POT_BINARY and DOWNKINGO_POT_PLUGIN are required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	manager := NewManager(ctx, binaryPath, pluginPath, filepath.Join(t.TempDir(), "cache"))
	defer manager.Stop()
	args, err := manager.YtDlpArgs(ctx, "https://www.youtube.com/watch?v=test", false)
	if err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(args, " ")
	if !strings.Contains(joined, "youtubepot-bgutilhttp:base_url=http://127.0.0.1:") {
		t.Fatalf("managed provider arguments are incomplete: %s", joined)
	}
}

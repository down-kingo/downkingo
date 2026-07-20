package pot

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestCurrentBinaryAssetIsPinned(t *testing.T) {
	asset, err := BinaryAsset()
	if err != nil {
		if runtime.GOOS == "windows" && runtime.GOARCH == "amd64" {
			t.Fatal(err)
		}
		t.Skip(err)
	}
	if asset.URL == "" || asset.LocalName == "" || len(asset.SHA256) != 64 || asset.Size <= 0 {
		t.Fatalf("incomplete asset: %+v", asset)
	}
	if !strings.Contains(asset.URL, "/v"+SupportedVersion+"/") {
		t.Fatalf("asset URL is not pinned to v%s: %s", SupportedVersion, asset.URL)
	}
}

func TestValidatePluginRejectsUnexpectedArchive(t *testing.T) {
	path := filepath.Join(t.TempDir(), PluginFileName)
	if err := os.WriteFile(path, []byte("not the pinned plugin"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := ValidatePlugin(path); err == nil {
		t.Fatal("unexpected plugin archive was accepted")
	}
}

func TestYouTubeURLDetection(t *testing.T) {
	tests := map[string]bool{
		"https://www.youtube.com/watch?v=abc":   true,
		"https://music.youtube.com/watch?v=abc": true,
		"https://youtu.be/abc":                  true,
		"https://youtube.com.evil.test/watch":   false,
		"https://www.instagram.com/p/abc":       false,
		"not a URL":                             false,
	}
	for rawURL, expected := range tests {
		if actual := isYouTubeURL(rawURL); actual != expected {
			t.Errorf("isYouTubeURL(%q) = %v, want %v", rawURL, actual, expected)
		}
	}
}

func TestBuildYtDlpArgsUsesMWebOnlyWithoutAuthentication(t *testing.T) {
	publicArgs := strings.Join(buildYtDlpArgs("plugins", "http://127.0.0.1:1234", false), " ")
	if !strings.Contains(publicArgs, "youtube:player_client=mweb") {
		t.Fatalf("public arguments do not select mweb: %s", publicArgs)
	}
	if !strings.Contains(publicArgs, "youtubepot-bgutilhttp:base_url=http://127.0.0.1:1234") {
		t.Fatalf("provider base URL is missing: %s", publicArgs)
	}
	authenticatedArgs := strings.Join(buildYtDlpArgs("plugins", "http://127.0.0.1:1234", true), " ")
	if strings.Contains(authenticatedArgs, "player_client=mweb") {
		t.Fatalf("authenticated arguments unexpectedly force mweb: %s", authenticatedArgs)
	}
}

func TestManagerReportsValidationFailureWithoutStartingForOtherSites(t *testing.T) {
	manager := NewManager(t.Context(), filepath.Join(t.TempDir(), "missing-provider"), filepath.Join(t.TempDir(), PluginFileName), t.TempDir())
	var messages []string
	manager.SetLogCallback(func(message string) { messages = append(messages, message) })

	if args, err := manager.YtDlpArgs(t.Context(), "https://example.com/video", false); err != nil || args != nil {
		t.Fatalf("non-YouTube options = %v, %v", args, err)
	}
	if len(messages) != 0 {
		t.Fatalf("non-YouTube request emitted provider logs: %v", messages)
	}

	if _, err := manager.YtDlpArgs(t.Context(), "https://www.youtube.com/watch?v=test", false); err == nil {
		t.Fatal("missing provider unexpectedly started")
	}
	joined := strings.Join(messages, " ")
	if !strings.Contains(joined, "Iniciando") || !strings.Contains(joined, "não passou na validação") {
		t.Fatalf("provider diagnostics are incomplete: %v", messages)
	}
}

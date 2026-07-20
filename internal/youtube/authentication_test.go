package youtube

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestIsAuthenticationRequired(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "youtube anti bot", err: errors.New("Sign in to confirm you're not a bot. Use --cookies-from-browser"), want: true},
		{name: "typographic apostrophe", err: errors.New("Sign in to confirm you’re not a bot"), want: true},
		{name: "private video", err: errors.New("Private video"), want: true},
		{name: "unrelated extractor failure", err: errors.New("unable to extract player response"), want: false},
		{name: "nil", err: nil, want: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := IsAuthenticationRequired(test.err); got != test.want {
				t.Fatalf("IsAuthenticationRequired() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestNormalizeCookieBrowser(t *testing.T) {
	browser, err := NormalizeCookieBrowser(" Chrome ")
	if err != nil || browser != "chrome" {
		t.Fatalf("expected normalized chrome, got %q, %v", browser, err)
	}
	if _, err := NormalizeCookieBrowser("chrome --verbose"); err == nil {
		t.Fatal("expected invalid browser to be rejected")
	}
}

func TestCommandBuilderAddsJavaScriptRuntimeOnce(t *testing.T) {
	client := NewClient("yt-dlp", "ffmpeg", t.TempDir())
	cmd, err := client.createCommandWithContext(context.Background(), []string{
		"--dump-json", "https://www.youtube.com/watch?v=test",
	})
	if err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(cmd.Args, " ")
	if count := strings.Count(joined, "--js-runtimes"); count != 1 {
		t.Fatalf("--js-runtimes count = %d in %s", count, joined)
	}
	if !strings.Contains(joined, "--js-runtimes bun") {
		t.Fatalf("Bun runtime is missing from %s", joined)
	}
}

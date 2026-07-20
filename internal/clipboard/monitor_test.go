package clipboard

import (
	"strings"
	"testing"
)

func TestMonitorValidURLRequiresExactDomainOrSubdomain(t *testing.T) {
	m := &Monitor{}
	valid := []string{
		"https://youtube.com/watch?v=abc",
		"https://www.youtube.com/watch?v=abc",
		"https://x.com/user/status/1",
		"https://reddit.com:443/r/videos",
	}
	for _, rawURL := range valid {
		if !m.isValidURL(rawURL) {
			t.Errorf("expected valid URL: %s", rawURL)
		}
	}

	invalid := []string{
		"https://youtube.com.evil.example/watch?v=abc",
		"https://notyoutube.com/watch?v=abc",
		"javascript://youtube.com/test",
		"https://example.com/?next=youtube.com",
	}
	for _, rawURL := range invalid {
		if m.isValidURL(rawURL) {
			t.Errorf("expected invalid URL: %s", rawURL)
		}
	}
}

func TestPlatformNameUsesParsedHostname(t *testing.T) {
	if got := platformName("https://music.youtube.com/watch?v=abc"); got != "YouTube" {
		t.Fatalf("platformName() = %q, want YouTube", got)
	}
	if got := platformName("https://example.com/?url=youtube.com"); got != "Link" {
		t.Fatalf("platformName() trusted query text: %q", got)
	}
}

func TestLimitStringPreservesUTF8(t *testing.T) {
	got := limitString(strings.Repeat("ç", 10), 5)
	if got != strings.Repeat("ç", 5)+"..." {
		t.Fatalf("limitString() = %q", got)
	}
}

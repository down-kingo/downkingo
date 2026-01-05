package validate_test

import (
	"testing"

	"kingo/internal/validate"
)

func TestURL(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"valid https URL", "https://youtube.com/watch?v=123", false},
		{"valid http URL", "http://example.com", false},
		{"empty URL", "", true},
		{"no scheme", "youtube.com/watch", true},
		{"ftp scheme rejected", "ftp://example.com", true},
		{"whitespace only", "   ", true},
		{"URL with spaces trimmed", "  https://example.com  ", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := validate.URL(tt.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("URL(%q) error = %v, wantErr = %v", tt.url, err, tt.wantErr)
			}
		})
	}
}

func TestMediaURL(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"YouTube URL", "https://youtube.com/watch?v=123", false},
		{"YouTube short URL", "https://youtu.be/123", false},
		{"Instagram URL", "https://instagram.com/p/123", false},
		{"Twitter URL", "https://twitter.com/user/status/123", false},
		{"X.com URL", "https://x.com/user/status/123", false},
		{"TikTok URL", "https://tiktok.com/@user/video/123", false},
		{"Unsupported platform", "https://randomsite.com/video", true},
		{"Empty URL", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := validate.MediaURL(tt.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("MediaURL(%q) error = %v, wantErr = %v", tt.url, err, tt.wantErr)
			}
		})
	}
}

func TestFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"normal filename", "video.mp4", "video.mp4"},
		{"empty becomes untitled", "", "untitled"},
		{"removes special chars", "video<>:\"/\\|?*.mp4", "video_________.mp4"},
		{"trims spaces and dots", "  video.mp4.. ", "video.mp4"},
		{"very long filename truncated", string(make([]byte, 300)), string(make([]byte, 200))},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validate.Filename(tt.input)
			if tt.name == "very long filename truncated" {
				if len(result) > 200 {
					t.Errorf("Filename length = %d, want <= 200", len(result))
				}
			} else if result != tt.expected {
				t.Errorf("Filename(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestQualityValue(t *testing.T) {
	tests := []struct {
		name     string
		input    int
		expected int
	}{
		{"negative becomes 0", -10, 0},
		{"zero stays 0", 0, 0},
		{"normal value", 75, 75},
		{"100 stays 100", 100, 100},
		{"above 100 capped", 150, 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validate.QualityValue(tt.input)
			if result != tt.expected {
				t.Errorf("QualityValue(%d) = %d, want %d", tt.input, result, tt.expected)
			}
		})
	}
}

func TestPositiveInt(t *testing.T) {
	tests := []struct {
		name         string
		value        int
		defaultValue int
		expected     int
	}{
		{"negative uses default", -5, 10, 10},
		{"zero uses default", 0, 10, 10},
		{"positive uses value", 5, 10, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validate.PositiveInt(tt.value, tt.defaultValue)
			if result != tt.expected {
				t.Errorf("PositiveInt(%d, %d) = %d, want %d", tt.value, tt.defaultValue, result, tt.expected)
			}
		})
	}
}

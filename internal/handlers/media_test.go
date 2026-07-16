package handlers

import (
	"testing"

	"kingo/internal/youtube"
)

func TestCarouselMediaType(t *testing.T) {
	tests := []struct {
		name     string
		info     youtube.VideoInfo
		url      string
		expected string
	}{
		{name: "image thumbnail", url: "https://cdn.example/photo.webp", expected: "image"},
		{name: "duration", info: youtube.VideoInfo{Duration: 3}, url: "https://cdn.example/media", expected: "video"},
		{name: "formats", info: youtube.VideoInfo{Formats: []youtube.Format{{URL: "https://cdn.example/media"}}}, expected: "video"},
		{name: "mp4 URL", url: "https://cdn.example/media.mp4?token=1", expected: "video"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := carouselMediaType(test.info, test.url); actual != test.expected {
				t.Fatalf("expected %s, got %s", test.expected, actual)
			}
		})
	}
}

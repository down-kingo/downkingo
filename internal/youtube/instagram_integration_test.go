package youtube

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

const instagramCarouselIntegrationURL = "https://www.instagram.com/p/DZhtmKzjgF7/"

func TestInstagramImageCarouselIntegration(t *testing.T) {
	if os.Getenv("DOWNKINGO_INSTAGRAM_INTEGRATION") != "1" {
		t.Skip("set DOWNKINGO_INSTAGRAM_INTEGRATION=1 to query the real Instagram post")
	}
	ytDlpPath := os.Getenv("DOWNKINGO_YTDLP")
	if ytDlpPath == "" {
		t.Skip("set DOWNKINGO_YTDLP to the yt-dlp executable")
	}

	client := NewClient(ytDlpPath, "ffmpeg", t.TempDir())
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	items, err := client.GetPlaylistInfo(ctx, instagramCarouselIntegrationURL)
	if err != nil {
		t.Fatalf("Instagram carousel extraction failed: %v", err)
	}
	if len(items) != 8 {
		t.Fatalf("expected 8 carousel images, got %d", len(items))
	}
	for index, item := range items {
		if !strings.HasPrefix(item.Thumbnail, "http") {
			t.Errorf("item %d has no usable image URL: %q", index+1, item.Thumbnail)
		}
		if strings.Contains(item.Thumbnail, "s640x640") {
			t.Errorf("item %d still uses the low-resolution preview: %q", index+1, item.Thumbnail)
		}
	}
}

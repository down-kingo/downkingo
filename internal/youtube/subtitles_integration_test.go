package youtube

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestImportRemoteSubtitlesIntegration(t *testing.T) {
	if os.Getenv("DOWNKINGO_SUBTITLE_INTEGRATION") != "1" {
		t.Skip("set DOWNKINGO_SUBTITLE_INTEGRATION=1 to import a real subtitle track")
	}
	ytDlpPath := os.Getenv("DOWNKINGO_YTDLP")
	ffmpegPath := os.Getenv("DOWNKINGO_FFMPEG")
	videoURL := os.Getenv("DOWNKINGO_SUBTITLE_URL")
	if ytDlpPath == "" || ffmpegPath == "" || videoURL == "" {
		t.Skip("set DOWNKINGO_YTDLP, DOWNKINGO_FFMPEG and DOWNKINGO_SUBTITLE_URL")
	}
	language := os.Getenv("DOWNKINGO_SUBTITLE_LANGUAGE")
	if language == "" {
		language = "en"
	}

	client := NewClient(ytDlpPath, ffmpegPath, t.TempDir())
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	result, err := client.GetSubtitles(ctx, videoURL, language)
	if err != nil {
		t.Fatal(err)
	}
	if result.Language == "" || len(result.Cues) == 0 {
		t.Fatalf("remote track was empty: %#v", result)
	}
	for index, cue := range result.Cues {
		if cue.End <= cue.Start || cue.Text == "" {
			t.Fatalf("invalid cue %d: %#v", index, cue)
		}
	}
}

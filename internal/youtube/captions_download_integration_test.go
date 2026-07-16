package youtube

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDownloadWithBurnedCaptionsIntegration(t *testing.T) {
	if os.Getenv("DOWNKINGO_CAPTION_DOWNLOAD_INTEGRATION") != "1" {
		t.Skip("set DOWNKINGO_CAPTION_DOWNLOAD_INTEGRATION=1 to download and render a real video")
	}
	ytDlpPath := os.Getenv("DOWNKINGO_YTDLP")
	ffmpegPath := os.Getenv("DOWNKINGO_FFMPEG")
	videoURL := os.Getenv("DOWNKINGO_CAPTION_DOWNLOAD_URL")
	if ytDlpPath == "" || ffmpegPath == "" || videoURL == "" {
		t.Skip("set DOWNKINGO_YTDLP, DOWNKINGO_FFMPEG and DOWNKINGO_CAPTION_DOWNLOAD_URL")
	}

	outputDir := t.TempDir()
	client := NewClient(ytDlpPath, ffmpegPath, outputDir)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	var logs []string
	err := client.Download(ctx, DownloadOptions{
		URL:         videoURL,
		Format:      "best[height<=360]/best",
		RemuxVideo:  true,
		RemuxFormat: "mp4",
		StartTime:   "00:00:00",
		EndTime:     "00:00:08",
		Captions: CaptionOptions{
			Enabled: true,
			Source:  "auto",
			Cues:    []SubtitleCue{{Start: 0, End: 3, Text: "DownKingo caption integration"}},
			Style: SubtitleStyle{
				FontFamily:        "Arial",
				FontSize:          56,
				TextColor:         "#FFFFFF",
				BackgroundColor:   "#000000",
				BackgroundOpacity: 0.55,
				OutlineColor:      "#000000",
				OutlineWidth:      3,
				Position:          "bottom",
				Bold:              true,
			},
		},
	}, nil, func(line string) {
		logs = append(logs, line)
	})
	if err != nil {
		t.Fatalf("download with captions failed: %v\n%s", err, strings.Join(logs, "\n"))
	}

	files, err := filepath.Glob(filepath.Join(outputDir, "*.mp4"))
	if err != nil || len(files) != 1 {
		t.Fatalf("expected one rendered MP4, got %v (err=%v)", files, err)
	}
	info, err := os.Stat(files[0])
	if err != nil || info.Size() == 0 {
		t.Fatalf("rendered video is empty: %v", err)
	}
	if workspaces, _ := filepath.Glob(filepath.Join(outputDir, ".downkingo-edit-*")); len(workspaces) != 0 {
		t.Fatalf("temporary edit workspaces remain: %v", workspaces)
	}
}

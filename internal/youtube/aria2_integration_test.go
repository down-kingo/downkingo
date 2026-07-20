package youtube

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestVerifiedAria2DownloadIntegration(t *testing.T) {
	if os.Getenv("DOWNKINGO_ARIA2_INTEGRATION") != "1" {
		t.Skip("set DOWNKINGO_ARIA2_INTEGRATION=1 to run the real yt-dlp/aria2c integration")
	}
	ytDlpPath := os.Getenv("DOWNKINGO_YTDLP")
	ffmpegPath := os.Getenv("DOWNKINGO_FFMPEG")
	aria2Path := os.Getenv("DOWNKINGO_ARIA2")
	if ytDlpPath == "" || ffmpegPath == "" || aria2Path == "" {
		t.Skip("set DOWNKINGO_YTDLP, DOWNKINGO_FFMPEG and DOWNKINGO_ARIA2")
	}

	outputDir := t.TempDir()
	client := NewClient(ytDlpPath, ffmpegPath, outputDir)
	client.SetAria2Path(aria2Path)
	if !client.HasAria2() {
		t.Fatal("the supplied aria2c runtime did not pass DownKingo validation")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	var logs []string
	var completed bool
	err := client.Download(ctx, DownloadOptions{
		URL:    "https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0.tar.xz",
		Format: "best", UseAria2c: true, Aria2cConnections: 4, ConcurrentFragments: 8,
	}, func(progress DownloadProgress) {
		completed = completed || progress.Status == "completed"
	}, func(line string) { logs = append(logs, line) })
	if err != nil {
		t.Fatalf("verified aria2c download failed: %v\n%s", err, strings.Join(logs, "\n"))
	}
	if !completed {
		t.Fatal("download completed without the terminal progress event")
	}
	files, err := os.ReadDir(outputDir)
	if err != nil || len(files) == 0 {
		t.Fatalf("download produced no output: files=%d err=%v", len(files), err)
	}
	info, err := files[0].Info()
	if err != nil || info.Size() == 0 {
		t.Fatalf("downloaded file is empty: %v", err)
	}
	if partials, _ := filepath.Glob(filepath.Join(outputDir, "*.aria2")); len(partials) != 0 {
		t.Fatalf("incomplete aria2 control files remain: %v", partials)
	}
}

package youtube

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestRenderTimelineCutsIntegration(t *testing.T) {
	ffmpegPath := os.Getenv("DOWNKINGO_FFMPEG")
	if ffmpegPath == "" {
		t.Skip("set DOWNKINGO_FFMPEG to run the real FFmpeg timeline test")
	}

	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	outputDir := filepath.Join(root, "output")
	if err := os.MkdirAll(workspace, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		t.Fatal(err)
	}

	inputPath := filepath.Join(workspace, "timeline-source.mp4")
	generate := exec.Command(ffmpegPath,
		"-hide_banner", "-loglevel", "error", "-y",
		"-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=6",
		"-f", "lavfi", "-i", "sine=frequency=440:duration=6",
		"-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", inputPath,
	)
	if output, err := generate.CombinedOutput(); err != nil {
		t.Fatalf("generate fixture: %v: %s", err, output)
	}

	client := NewClient("yt-dlp", ffmpegPath, outputDir)
	options := DownloadOptions{Captions: CaptionOptions{
		Enabled: true,
		Source:  "auto",
		Cues: []SubtitleCue{
			{Start: 0.5, End: 2.5, Text: "Before the cut"},
			{Start: 4.5, End: 5.5, Text: "After the cut"},
		},
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
	}}
	if err := client.renderTimelineCuts(context.Background(), workspace, []CutRange{{Start: 2, End: 4}}, options); err != nil {
		t.Fatal(err)
	}

	outputPath := filepath.Join(outputDir, "timeline-source.mp4")
	duration, hasAudio, err := client.probeMedia(context.Background(), outputPath)
	if err != nil {
		t.Fatal(err)
	}
	if duration < 3.8 || duration > 4.2 {
		t.Fatalf("edited duration = %.3f, want about 4 seconds", duration)
	}
	if !hasAudio {
		t.Fatal("edited output lost its audio stream")
	}
}

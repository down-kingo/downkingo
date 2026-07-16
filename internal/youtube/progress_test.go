package youtube

import (
	"context"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseProgressBytes(t *testing.T) {
	downloaded, total, ok := parseProgressBytes("[download]  25.0% of 100.00MiB at 5.00MiB/s ETA 00:15")
	if !ok {
		t.Fatal("standard yt-dlp progress was not parsed")
	}
	if math.Abs(total-100*1024*1024) > 0.1 || math.Abs(downloaded-25*1024*1024) > 0.1 {
		t.Fatalf("unexpected byte values: downloaded=%f total=%f", downloaded, total)
	}
}

func TestParseProgressBytesSupportsDecimalUnits(t *testing.T) {
	downloaded, total, ok := parseProgressBytes("[download] 50% of 20MB")
	if !ok || total != 20_000_000 || downloaded != 10_000_000 {
		t.Fatalf("unexpected decimal values: downloaded=%f total=%f ok=%v", downloaded, total, ok)
	}
}

func TestFormatAverageSpeed(t *testing.T) {
	if got := formatAverageSpeed(42.96 * 1024 * 1024); got != "42.96 MiB/s avg" {
		t.Fatalf("formatAverageSpeed = %q", got)
	}
}

func TestSetAria2PathRejectsCorruptExecutable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "aria2c.exe")
	if err := os.WriteFile(path, []byte("corrupt"), 0600); err != nil {
		t.Fatal(err)
	}
	client := NewClient("yt-dlp", "ffmpeg", t.TempDir())
	client.SetAria2Path(path)
	if client.HasAria2() {
		t.Fatal("corrupt aria2c was configured")
	}
}

func TestDownloadDoesNotSilentlyFallbackWhenTurboRuntimeIsMissing(t *testing.T) {
	client := NewClient("yt-dlp", "ffmpeg", t.TempDir())
	err := client.Download(context.Background(), DownloadOptions{
		URL: "https://example.com/video.mp4", UseAria2c: true,
	}, nil, nil)
	if err == nil || !strings.Contains(err.Error(), "verified runtime is not installed") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestNormalizeCutRangesMergesOverlaps(t *testing.T) {
	got := normalizeCutRanges([]CutRange{
		{Start: 20, End: 30},
		{Start: 5, End: 10},
		{Start: 9.98, End: 15},
		{Start: -4, End: 2},
	})
	if len(got) != 3 {
		t.Fatalf("got %d ranges, want 3: %#v", len(got), got)
	}
	if got[0].Start != 0 || got[0].End != 2 || got[1].Start != 5 || got[1].End != 15 {
		t.Fatalf("unexpected normalized ranges: %#v", got)
	}
}

func TestKeptRangesCreatesRippleTimeline(t *testing.T) {
	got := keptRanges([]CutRange{{Start: 10, End: 20}, {Start: 30, End: 35}}, 50)
	want := []CutRange{{Start: 0, End: 10}, {Start: 20, End: 30}, {Start: 35, End: 50}}
	if len(got) != len(want) {
		t.Fatalf("got %#v, want %#v", got, want)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("segment %d = %#v, want %#v", index, got[index], want[index])
		}
	}
}

func TestBuildTimelineFilterJoinsVideoAndAudio(t *testing.T) {
	filter := buildTimelineFilter([]CutRange{{Start: 0, End: 10}, {Start: 20, End: 30}}, false, true)
	for _, expected := range []string{
		"[0:v:0]trim=start=0.000000:end=10.000000",
		"[0:a:0]atrim=start=20.000000:end=30.000000",
		"[v0][a0][v1][a1]concat=n=2:v=1:a=1[vout][aout]",
	} {
		if !strings.Contains(filter, expected) {
			t.Fatalf("filter %q does not contain %q", filter, expected)
		}
	}
}

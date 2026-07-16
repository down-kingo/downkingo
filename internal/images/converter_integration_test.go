package images

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestConvertFormatAndScaleIntegration(t *testing.T) {
	if os.Getenv("DOWNKINGO_IMAGE_INTEGRATION") != "1" {
		t.Skip("set DOWNKINGO_IMAGE_INTEGRATION=1 to run the real FFmpeg conversion")
	}
	ffmpegPath := os.Getenv("DOWNKINGO_FFMPEG")
	ffprobePath := os.Getenv("DOWNKINGO_FFPROBE")
	if ffmpegPath == "" || ffprobePath == "" {
		t.Skip("set DOWNKINGO_FFMPEG and DOWNKINGO_FFPROBE")
	}

	inputPath := filepath.Join(t.TempDir(), "source.png")
	generate := exec.Command(ffmpegPath, "-f", "lavfi", "-i", "color=c=blue:s=100x80", "-frames:v", "1", "-y", inputPath)
	generate.SysProcAttr = getSysProcAttr()
	if output, err := generate.CombinedOutput(); err != nil {
		t.Fatalf("generate fixture: %v\n%s", err, output)
	}

	outputPath, err := Convert(inputPath, "webp", 90, 50, ffmpegPath, "")
	if err != nil {
		t.Fatalf("convert fixture: %v", err)
	}
	if filepath.Ext(outputPath) != ".webp" {
		t.Fatalf("expected WEBP output, got %q", outputPath)
	}

	probe := exec.Command(ffprobePath, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", outputPath)
	probe.SysProcAttr = getSysProcAttr()
	dimensions, err := probe.Output()
	if err != nil {
		t.Fatalf("probe converted image: %v", err)
	}
	if strings.TrimSpace(string(dimensions)) != "50,40" {
		t.Fatalf("expected 50x40 output, got %q", dimensions)
	}

	reencodedPath, err := Convert(outputPath, "webp", 50, 100, ffmpegPath, "")
	if err != nil {
		t.Fatalf("re-encode same format: %v", err)
	}
	if reencodedPath != outputPath {
		t.Fatalf("same-format conversion changed destination: %q", reencodedPath)
	}
}

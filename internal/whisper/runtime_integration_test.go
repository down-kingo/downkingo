package whisper

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestDownloadPinnedRuntimeIntegration(t *testing.T) {
	if os.Getenv("DOWNKINGO_WHISPER_INTEGRATION") != "1" {
		t.Skip("set DOWNKINGO_WHISPER_INTEGRATION=1 to verify the pinned upstream runtime")
	}
	testDir := t.TempDir()
	ffmpegPath := os.Getenv("DOWNKINGO_FFMPEG")
	client := NewClient(testDir, ffmpegPath)
	if err := client.DownloadBinary(); err != nil {
		t.Fatalf("DownloadBinary failed: %v", err)
	}
	if !client.IsBinaryInstalled() {
		t.Fatal("downloaded runtime did not pass installation validation")
	}
	if ffmpegPath == "" {
		return
	}
	if err := client.DownloadModel("tiny"); err != nil {
		t.Fatalf("could not download the pinned tiny model: %v", err)
	}
	inputPath := filepath.Join(testDir, "tone.wav")
	cmd := exec.Command(ffmpegPath, "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-ar", "16000", "-ac", "1", inputPath)
	hideWindow(cmd)
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("could not create integration audio: %v: %s", err, output)
	}
	result, err := client.TranscribeFile(inputPath, "tiny", "en", "txt", false)
	if err != nil {
		t.Fatalf("JSON transcription integration failed: %v", err)
	}
	if result == nil || result.Language != "en" {
		t.Fatalf("unexpected transcription result: %#v", result)
	}
}

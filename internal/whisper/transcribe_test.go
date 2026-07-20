package whisper

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseWhisperJSON(t *testing.T) {
	fixture := []byte(`{
  "result": {"language": "pt"},
  "transcription": [
    {"offsets": {"from": 0, "to": 1250}, "text": " Olá mundo."},
    {"offsets": {"from": 1250, "to": 4000}, "text": "Segundo trecho."}
  ]
}`)

	result, err := parseWhisperJSON(fixture, "txt")
	if err != nil {
		t.Fatalf("parseWhisperJSON returned error: %v", err)
	}
	if result.Language != "pt" {
		t.Fatalf("Language = %q, want pt", result.Language)
	}
	if result.Text != "Olá mundo. Segundo trecho." {
		t.Fatalf("Text = %q", result.Text)
	}
	if result.Duration != 4 || len(result.Segments) != 2 {
		t.Fatalf("unexpected segments/duration: %#v", result)
	}
}

func TestParseWhisperJSONFormatsSubtitles(t *testing.T) {
	fixture := []byte(`{"result":{"language":"en"},"transcription":[{"offsets":{"from":1234,"to":4567},"text":"Hello"}]}`)

	srt, err := parseWhisperJSON(fixture, "srt")
	if err != nil {
		t.Fatal(err)
	}
	if srt.Text != "1\n00:00:01,234 --> 00:00:04,567\nHello" {
		t.Fatalf("unexpected SRT: %q", srt.Text)
	}

	vtt, err := parseWhisperJSON(fixture, "vtt")
	if err != nil {
		t.Fatal(err)
	}
	if vtt.Text != "WEBVTT\n\n00:00:01.234 --> 00:00:04.567\nHello" {
		t.Fatalf("unexpected VTT: %q", vtt.Text)
	}
}

func TestParseWhisperJSONRejectsUnknownOutput(t *testing.T) {
	_, err := parseWhisperJSON([]byte(`{"result":{},"transcription":[]}`), "xml")
	if err == nil {
		t.Fatal("expected unsupported output error")
	}
}

func TestRuntimeVersionParsing(t *testing.T) {
	if got := parseRuntimeVersion("whisper.cpp version: 1.9.1\n"); got != "1.9.1" {
		t.Fatalf("parseRuntimeVersion = %q", got)
	}
	if got := parseRuntimeVersion("usage only"); got != "" {
		t.Fatalf("legacy output parsed as %q", got)
	}
}

func TestExtractRuntimeArchiveFlattensOnlyRuntimeFiles(t *testing.T) {
	asset := runtimeAsset{
		BinaryName: "whisper-cli.exe",
		Required:   []string{"whisper-cli.exe", "whisper.dll", "ggml.dll", "ggml-base.dll", "SDL2.dll"},
	}
	var archive bytes.Buffer
	w := zip.NewWriter(&archive)
	for _, name := range append(asset.Required, "ggml-cpu-x64.dll", "unrelated.exe") {
		entry, err := w.Create("Release/" + name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = entry.Write([]byte("content"))
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}

	archivePath := filepath.Join(t.TempDir(), "runtime.zip")
	if err := os.WriteFile(archivePath, archive.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	destination := t.TempDir()
	if err := extractRuntimeArchive(archivePath, destination, asset); err != nil {
		t.Fatal(err)
	}
	for _, name := range append(asset.Required, "ggml-cpu-x64.dll") {
		if _, err := os.Stat(filepath.Join(destination, name)); err != nil {
			t.Fatalf("expected %s to be extracted: %v", name, err)
		}
	}
	if _, err := os.Stat(filepath.Join(destination, "unrelated.exe")); !os.IsNotExist(err) {
		t.Fatalf("unrelated executable should not be extracted")
	}
}

func TestModelCatalogIncludesQuantizedModelsAndRejectsUnknownNames(t *testing.T) {
	for _, name := range []string{"small-q5_1", "medium-q5_0", "large-v3-turbo-q5_0"} {
		spec, ok := findModelSpec(name)
		if !ok || spec.SHA256 == "" || spec.Bytes == 0 {
			t.Fatalf("model %s is missing verified metadata", name)
		}
	}
	if _, ok := findModelSpec("../../outside"); ok {
		t.Fatal("unknown/path-like model name was accepted")
	}
	for _, spec := range supportedModels {
		if strings.ContainsAny(spec.FileName, `/\\`) {
			t.Fatalf("catalog filename is not a basename: %s", spec.FileName)
		}
	}
}

func TestModelVerificationDetectsChanges(t *testing.T) {
	content := []byte("verified model fixture")
	hash := sha256.Sum256(content)
	spec := modelSpec{Name: "fixture", FileName: "fixture.bin", Bytes: int64(len(content)), SHA256: hex.EncodeToString(hash[:])}
	path := filepath.Join(t.TempDir(), spec.FileName)
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatal(err)
	}
	if err := verifyInstalledModel(path, spec); err != nil {
		t.Fatalf("valid model was rejected: %v", err)
	}
	if _, err := os.Stat(modelVerificationPath(path)); err != nil {
		t.Fatalf("verification sidecar was not created: %v", err)
	}
	if err := os.WriteFile(path, []byte("tampered model fixture"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := verifyInstalledModel(path, spec); err == nil {
		t.Fatal("tampered model was accepted")
	}
}

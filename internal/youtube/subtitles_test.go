package youtube

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestVideoInfoCollectsCompactSubtitleLanguages(t *testing.T) {
	payload := []byte(`{
  "id":"abc",
  "title":"Captioned video",
  "duration":12.5,
  "language":"pt-BR",
  "subtitles":{"pt-BR":[{"name":"Português"}]},
  "automatic_captions":{"pt-BR":[{"name":"Português automático"}],"en":[{"name":"English"}],"live_chat":[{}]}
}`)
	var info VideoInfo
	if err := json.Unmarshal(payload, &info); err != nil {
		t.Fatal(err)
	}
	if info.ID != "abc" || info.Title != "Captioned video" || info.Duration != 12 {
		t.Fatalf("regular metadata was not preserved: %#v", info)
	}
	if len(info.SubtitleLanguages) != 2 {
		t.Fatalf("subtitle languages = %#v", info.SubtitleLanguages)
	}
	if got := info.SubtitleLanguages[0]; got.Code != "pt-BR" || got.Source != "manual" || got.Name != "Português" {
		t.Fatalf("manual subtitle did not win: %#v", got)
	}
	if preferred := preferredSubtitleLanguage(&info); preferred != "pt-BR" {
		t.Fatalf("preferred language = %q", preferred)
	}
}

func TestCaptionResolverFallsBackToInjectedWhisper(t *testing.T) {
	client := NewClient("yt-dlp", "ffmpeg", t.TempDir())
	called := false
	client.SetSubtitleTranscriber(func(_ context.Context, mediaPath, model, language string) ([]SubtitleCue, error) {
		called = true
		if filepath.Base(mediaPath) != "video.mp4" || model != "base" || language != "pt" {
			t.Fatalf("unexpected transcriber arguments: %s, %s, %s", mediaPath, model, language)
		}
		return []SubtitleCue{{Start: 0, End: 2, Text: "Fala detectada"}}, nil
	})
	workspace := t.TempDir()
	cues, err := client.resolveCaptionCues(context.Background(), workspace, filepath.Join(workspace, "video.mp4"), CaptionOptions{
		Source: "auto", Language: "pt-BR", Model: "base",
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !called || len(cues) != 1 || cues[0].Text != "Fala detectada" {
		t.Fatalf("unexpected fallback result: %#v", cues)
	}
}

func TestCaptionResolverHonorsYouTubeOnlyMode(t *testing.T) {
	client := NewClient("yt-dlp", "ffmpeg", t.TempDir())
	client.SetSubtitleTranscriber(func(_ context.Context, _, _, _ string) ([]SubtitleCue, error) {
		t.Fatal("Whisper must not run in YouTube-only mode")
		return nil, nil
	})
	workspace := t.TempDir()
	_, err := client.resolveCaptionCues(context.Background(), workspace, filepath.Join(workspace, "video.mp4"), CaptionOptions{Source: "youtube"}, nil)
	if err == nil {
		t.Fatal("expected a missing YouTube subtitle error")
	}
}

func TestParseTimedTextSupportsSRTAndVTT(t *testing.T) {
	fixture := `WEBVTT

00:00:01.250 --> 00:00:03.500 align:center
<c.colorE5E5E5>Olá &amp; bem-vindo</c>

2
00:04:05,010 --> 00:04:07,200
Segunda linha
continua aqui
`
	cues, err := parseTimedText(fixture)
	if err != nil {
		t.Fatal(err)
	}
	if len(cues) != 2 {
		t.Fatalf("cues = %#v", cues)
	}
	if cues[0].Start != 1.25 || cues[0].End != 3.5 || cues[0].Text != "Olá & bem-vindo" {
		t.Fatalf("unexpected first cue: %#v", cues[0])
	}
	if cues[1].Start != 245.01 || cues[1].Text != "Segunda linha\ncontinua aqui" {
		t.Fatalf("unexpected second cue: %#v", cues[1])
	}
}

func TestFindSubtitleFilePrefersRequestedLanguage(t *testing.T) {
	workspace := t.TempDir()
	for _, name := range []string{"captions.en.srt", "captions.pt-BR.srt"} {
		if err := os.WriteFile(filepath.Join(workspace, name), []byte("fixture"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	path, err := findSubtitleFileForLanguage(workspace, "pt-BR")
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(path) != "captions.pt-BR.srt" {
		t.Fatalf("selected subtitle = %s", path)
	}
}

func TestRippleSubtitleCuesFollowsTimelineCuts(t *testing.T) {
	cues := []SubtitleCue{
		{Start: 1, End: 3, Text: "before"},
		{Start: 3, End: 5, Text: "across cut"},
		{Start: 6, End: 7, Text: "after"},
	}
	segments := []CutRange{{Start: 0, End: 4}, {Start: 6, End: 10}}
	got := rippleSubtitleCues(cues, segments)
	if len(got) != 3 {
		t.Fatalf("ripple result = %#v", got)
	}
	if got[1].Start != 3 || got[1].End != 4 || got[2].Start != 4 || got[2].End != 5 {
		t.Fatalf("timestamps were not rippled: %#v", got)
	}
}

func TestBuildASSAppliesStyleAndEscapesOverrides(t *testing.T) {
	content := buildASS([]SubtitleCue{{Start: 1, End: 2.5, Text: "Hello {\\an8}\nworld"}}, SubtitleStyle{
		FontFamily:        "Montserrat",
		FontSize:          64,
		TextColor:         "#12ABEF",
		BackgroundColor:   "#112233",
		BackgroundOpacity: .5,
		OutlineColor:      "#000000",
		OutlineWidth:      4,
		Position:          "top",
		Bold:              true,
	})
	for _, expected := range []string{
		"Style: Background,Montserrat,64",
		"&H80332211",
		"Style: Default,Montserrat,64",
		"&H00EFAB12",
		",-1,0,0,0,100",
		",1,4,0,8,70,70,64,1",
		"Dialogue: 1,0:00:01.00,0:00:02.50",
		"Hello (\\an8)\\Nworld",
	} {
		if !strings.Contains(content, expected) {
			t.Fatalf("ASS output is missing %q:\n%s", expected, content)
		}
	}
}

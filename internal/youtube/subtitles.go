package youtube

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const maxSubtitleCues = 20000

type subtitleFormat struct {
	Name string `json:"name"`
}

// UnmarshalJSON keeps yt-dlp's potentially very large subtitles maps out of
// the frontend payload while exposing the compact language list the editor
// needs.
func (v *VideoInfo) UnmarshalJSON(data []byte) error {
	type videoInfoAlias VideoInfo
	aux := struct {
		*videoInfoAlias
		Subtitles         map[string][]subtitleFormat `json:"subtitles"`
		AutomaticCaptions map[string][]subtitleFormat `json:"automatic_captions"`
	}{videoInfoAlias: (*videoInfoAlias)(v)}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	v.SubtitleLanguages = collectSubtitleLanguages(aux.Subtitles, aux.AutomaticCaptions)
	return nil
}

func collectSubtitleLanguages(manual, automatic map[string][]subtitleFormat) []SubtitleLanguage {
	tracks := make(map[string]SubtitleLanguage, len(manual)+len(automatic))
	add := func(code, source string, formats []subtitleFormat) {
		code = strings.TrimSpace(code)
		if code == "" || code == "live_chat" || len(code) > 48 {
			return
		}
		if existing, ok := tracks[code]; ok && existing.Source == "manual" {
			return
		}
		name := code
		for _, format := range formats {
			if strings.TrimSpace(format.Name) != "" {
				name = strings.TrimSpace(format.Name)
				break
			}
		}
		tracks[code] = SubtitleLanguage{Code: code, Name: name, Source: source}
	}
	for code, formats := range automatic {
		add(code, "automatic", formats)
	}
	for code, formats := range manual {
		add(code, "manual", formats)
	}

	result := make([]SubtitleLanguage, 0, len(tracks))
	for _, track := range tracks {
		result = append(result, track)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Source != result[j].Source {
			return result[i].Source == "manual"
		}
		return strings.ToLower(result[i].Code) < strings.ToLower(result[j].Code)
	})
	return result
}

func preferredSubtitleLanguage(info *VideoInfo) string {
	if info == nil || len(info.SubtitleLanguages) == 0 {
		return ""
	}
	preferred := []string{info.Language}
	if base := strings.Split(info.Language, "-")[0]; base != info.Language {
		preferred = append(preferred, base)
	}
	preferred = append(preferred, "pt-BR", "pt", "en")
	for _, wanted := range preferred {
		for _, track := range info.SubtitleLanguages {
			if wanted != "" && strings.EqualFold(track.Code, wanted) {
				return track.Code
			}
		}
	}
	return info.SubtitleLanguages[0].Code
}

func subtitleSource(info *VideoInfo, language string) string {
	if info != nil {
		for _, track := range info.SubtitleLanguages {
			if strings.EqualFold(track.Code, language) {
				return track.Source
			}
		}
	}
	return "youtube"
}

func sanitizeSubtitleLanguage(language string) string {
	language = strings.TrimSpace(language)
	if len(language) > 48 {
		return ""
	}
	for _, char := range language {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') || strings.ContainsRune("-_.*", char) {
			continue
		}
		return ""
	}
	return language
}

// GetSubtitles imports one subtitle track without downloading the video. A
// successful response with no cues means the extractor did not expose a track
// and lets the editor select the local Whisper fallback.
func (c *Client) GetSubtitles(ctx context.Context, url, language string) (*SubtitleResult, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	language = sanitizeSubtitleLanguage(language)
	var info *VideoInfo
	var infoErr error
	if language == "" || language == "auto" {
		info, infoErr = c.GetVideoInfo(ctx, url)
		language = preferredSubtitleLanguage(info)
	}
	if language == "" {
		return &SubtitleResult{Cues: []SubtitleCue{}}, nil
	}

	workDir, err := os.MkdirTemp("", "downkingo-subtitles-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(workDir)

	args := []string{
		"--skip-download",
		"--write-subs",
		"--write-auto-subs",
		"--sub-langs", language,
		"--sub-format", "srt/vtt/best",
		"--convert-subs", "srt",
		"--no-playlist",
		"--no-warnings",
		"--extractor-retries", "1",
		"--socket-timeout", "15",
		"--ffmpeg-location", c.ffmpegPath,
		"-o", filepath.Join(workDir, "captions.%(ext)s"),
	}
	if browser := c.authBrowserForURL(url); browser != "" {
		args = append(args, "--cookies-from-browser", browser)
	}
	args = append(args, url)
	cmd, err := c.createCommandWithContext(ctx, args)
	if err != nil {
		return nil, err
	}
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	commandErr := cmd.Run()

	subtitlePath, findErr := findSubtitleFileForLanguage(workDir, language)
	if findErr != nil {
		if commandErr != nil {
			detail := strings.TrimSpace(sanitizeUTF8(output.String()))
			if detail != "" {
				return nil, fmt.Errorf("yt-dlp subtitles: %s", detail)
			}
			return nil, fmt.Errorf("yt-dlp subtitles: %w", commandErr)
		}
		// Metadata extraction can fail on a site while the subtitle command still
		// succeeds, so only surface that earlier error when both operations fail.
		if infoErr != nil {
			return nil, infoErr
		}
		return &SubtitleResult{Cues: []SubtitleCue{}, Language: language}, nil
	}

	cues, err := parseSubtitleFile(subtitlePath)
	if err != nil {
		return nil, err
	}
	return &SubtitleResult{
		Cues:     cues,
		Language: language,
		Source:   subtitleSource(info, language),
	}, nil
}

func findSubtitleFileForLanguage(root, language string) (string, error) {
	var candidates []string
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info == nil || info.IsDir() {
			return err
		}
		switch strings.ToLower(filepath.Ext(path)) {
		case ".srt", ".vtt":
			candidates = append(candidates, path)
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if len(candidates) == 0 {
		return "", os.ErrNotExist
	}
	language = strings.ToLower(sanitizeSubtitleLanguage(language))
	preferred := []string{language}
	if language == "" || language == "auto" {
		preferred = []string{"pt-br", "pt", "en"}
	}
	score := func(path string) int {
		extension := strings.ToLower(filepath.Ext(path))
		value := 0
		if extension == ".srt" {
			value += 10
		}
		stem := strings.TrimSuffix(strings.ToLower(filepath.Base(path)), extension)
		for index, code := range preferred {
			if code != "" && code != "auto" && strings.HasSuffix(stem, "."+code) {
				value += 1000 - index
				break
			}
		}
		return value
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		return score(candidates[i]) > score(candidates[j])
	})
	return candidates[0], nil
}

func parseSubtitleFile(path string) ([]SubtitleCue, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	extension := strings.ToLower(filepath.Ext(path))
	if extension != ".srt" && extension != ".vtt" {
		return nil, fmt.Errorf("unsupported subtitle format: %s", extension)
	}
	cues, err := parseTimedText(string(data))
	if err != nil {
		return nil, fmt.Errorf("parse subtitle %s: %w", filepath.Base(path), err)
	}
	return cues, nil
}

var (
	timestampLineRegex = regexp.MustCompile(`^\s*((?:\d{1,3}:)?\d{1,2}:\d{2}[,.]\d{3})\s+-->\s+((?:\d{1,3}:)?\d{1,2}:\d{2}[,.]\d{3})`)
	subtitleTagRegex   = regexp.MustCompile(`<[^>]*>`)
)

func parseSubtitleTimestamp(value string) (float64, error) {
	value = strings.ReplaceAll(strings.TrimSpace(value), ",", ".")
	parts := strings.Split(value, ":")
	if len(parts) != 2 && len(parts) != 3 {
		return 0, fmt.Errorf("invalid timestamp %q", value)
	}
	seconds, err := strconv.ParseFloat(parts[len(parts)-1], 64)
	if err != nil {
		return 0, err
	}
	minutes, err := strconv.ParseFloat(parts[len(parts)-2], 64)
	if err != nil {
		return 0, err
	}
	total := minutes*60 + seconds
	if len(parts) == 3 {
		hours, err := strconv.ParseFloat(parts[0], 64)
		if err != nil {
			return 0, err
		}
		total += hours * 3600
	}
	return total, nil
}

func cleanSubtitleText(lines []string) string {
	text := strings.Join(lines, "\n")
	text = strings.ReplaceAll(text, "\\N", "\n")
	text = strings.ReplaceAll(text, "\u200b", "")
	text = subtitleTagRegex.ReplaceAllString(text, "")
	text = html.UnescapeString(text)
	cleaned := make([]string, 0, len(lines))
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line != "" && (len(cleaned) == 0 || cleaned[len(cleaned)-1] != line) {
			cleaned = append(cleaned, line)
		}
	}
	return strings.Join(cleaned, "\n")
}

func parseTimedText(content string) ([]SubtitleCue, error) {
	content = strings.TrimPrefix(content, "\ufeff")
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")
	lines := strings.Split(content, "\n")
	cues := make([]SubtitleCue, 0)
	for index := 0; index < len(lines); index++ {
		match := timestampLineRegex.FindStringSubmatch(lines[index])
		if len(match) != 3 {
			continue
		}
		start, startErr := parseSubtitleTimestamp(match[1])
		end, endErr := parseSubtitleTimestamp(match[2])
		if startErr != nil || endErr != nil || end <= start {
			continue
		}
		textLines := make([]string, 0, 2)
		for index++; index < len(lines) && strings.TrimSpace(lines[index]) != ""; index++ {
			textLines = append(textLines, lines[index])
		}
		text := cleanSubtitleText(textLines)
		if text != "" {
			cues = append(cues, SubtitleCue{Start: start, End: end, Text: text})
			if len(cues) >= maxSubtitleCues {
				break
			}
		}
	}
	return normalizeSubtitleCues(cues), nil
}

func normalizeSubtitleCues(cues []SubtitleCue) []SubtitleCue {
	normalized := make([]SubtitleCue, 0, len(cues))
	for _, cue := range cues {
		cue.Start = max(0, cue.Start)
		cue.Text = strings.TrimSpace(cue.Text)
		if cue.End-cue.Start < 0.05 || cue.Text == "" {
			continue
		}
		if len(cue.Text) > 2000 {
			runes := []rune(cue.Text)
			if len(runes) > 2000 {
				cue.Text = string(runes[:2000])
			}
		}
		normalized = append(normalized, cue)
		if len(normalized) >= maxSubtitleCues {
			break
		}
	}
	sort.SliceStable(normalized, func(i, j int) bool { return normalized[i].Start < normalized[j].Start })
	result := make([]SubtitleCue, 0, len(normalized))
	for _, cue := range normalized {
		if len(result) > 0 {
			previous := &result[len(result)-1]
			if previous.Text == cue.Text && cue.Start <= previous.End+0.08 {
				previous.End = max(previous.End, cue.End)
				continue
			}
		}
		result = append(result, cue)
	}
	return result
}

package youtube

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// SubtitleTranscriber is injected by the application so the download package
// stays independent from a specific speech-to-text implementation.
type SubtitleTranscriber func(ctx context.Context, mediaPath, model, language string) ([]SubtitleCue, error)

var hexColorRegex = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func normalizeCaptionSource(source string) string {
	switch strings.ToLower(strings.TrimSpace(source)) {
	case "youtube", "whisper":
		return strings.ToLower(strings.TrimSpace(source))
	default:
		return "auto"
	}
}

func normalizeHexColor(value, fallback string) string {
	if hexColorRegex.MatchString(value) {
		return strings.ToUpper(value)
	}
	return fallback
}

func normalizeSubtitleStyle(style SubtitleStyle) SubtitleStyle {
	allowedFonts := map[string]bool{
		"Arial": true, "Montserrat": true, "Roboto": true, "Poppins": true,
		"Impact": true, "Georgia": true, "Courier New": true, "Trebuchet MS": true,
	}
	if !allowedFonts[style.FontFamily] {
		style.FontFamily = "Arial"
	}
	if style.FontSize < 24 || style.FontSize > 120 {
		style.FontSize = 56
	}
	style.TextColor = normalizeHexColor(style.TextColor, "#FFFFFF")
	style.BackgroundColor = normalizeHexColor(style.BackgroundColor, "#000000")
	style.OutlineColor = normalizeHexColor(style.OutlineColor, "#000000")
	style.BackgroundOpacity = math.Max(0, math.Min(1, style.BackgroundOpacity))
	if style.OutlineWidth < 0 || style.OutlineWidth > 12 {
		style.OutlineWidth = 3
	}
	switch style.Position {
	case "top", "center", "bottom":
	default:
		style.Position = "bottom"
	}
	return style
}

func (c *Client) resolveCaptionCues(
	ctx context.Context,
	workspace, inputPath string,
	opts CaptionOptions,
	onLog LogCallback,
) ([]SubtitleCue, error) {
	source := normalizeCaptionSource(opts.Source)
	if cues := normalizeSubtitleCues(opts.Cues); len(cues) > 0 {
		if onLog != nil {
			onLog(fmt.Sprintf("[Legendas] Usando %d trechos revisados no editor.", len(cues)))
		}
		return cues, nil
	}

	if source != "whisper" {
		if subtitlePath, err := findSubtitleFileForLanguage(workspace, opts.Language); err == nil {
			cues, parseErr := parseSubtitleFile(subtitlePath)
			if parseErr != nil {
				return nil, parseErr
			}
			if len(cues) > 0 {
				if onLog != nil {
					onLog(fmt.Sprintf("[Legendas] Faixa do vídeo importada (%d trechos).", len(cues)))
				}
				return cues, nil
			}
		}
	}

	if source == "youtube" {
		return nil, errors.New("o vídeo não possui legenda no idioma selecionado")
	}
	if c.subtitleTranscriber == nil {
		return nil, errors.New("o vídeo não possui legenda e o fallback de transcrição local não está disponível")
	}
	if onLog != nil {
		onLog("[Legendas] Nenhuma faixa encontrada; transcrevendo a voz localmente com Whisper...")
	}
	language := strings.ToLower(strings.TrimSpace(opts.Language))
	if language == "" || language == "auto" {
		language = "auto"
	} else if separator := strings.IndexAny(language, "-_"); separator > 0 {
		language = language[:separator]
	}
	cues, err := c.subtitleTranscriber(ctx, inputPath, opts.Model, language)
	if err != nil {
		return nil, fmt.Errorf("transcrever legendas com Whisper: %w", err)
	}
	cues = normalizeSubtitleCues(cues)
	if len(cues) == 0 {
		return nil, errors.New("a transcrição não encontrou fala no vídeo")
	}
	if onLog != nil {
		onLog(fmt.Sprintf("[Legendas] Transcrição concluída (%d trechos).", len(cues)))
	}
	return cues, nil
}

func rippleSubtitleCues(cues []SubtitleCue, segments []CutRange) []SubtitleCue {
	if len(segments) == 0 {
		return nil
	}
	result := make([]SubtitleCue, 0, len(cues))
	outputOffset := 0.0
	for _, segment := range segments {
		for _, cue := range cues {
			start := math.Max(cue.Start, segment.Start)
			end := math.Min(cue.End, segment.End)
			if end-start < 0.05 {
				continue
			}
			result = append(result, SubtitleCue{
				Start: outputOffset + start - segment.Start,
				End:   outputOffset + end - segment.Start,
				Text:  cue.Text,
			})
		}
		outputOffset += segment.End - segment.Start
	}
	return normalizeSubtitleCues(result)
}

func assColor(hexColor string, alpha byte) string {
	value := strings.TrimPrefix(normalizeHexColor(hexColor, "#FFFFFF"), "#")
	red := value[0:2]
	green := value[2:4]
	blue := value[4:6]
	return fmt.Sprintf("&H%02X%s%s%s", alpha, blue, green, red)
}

func assTimestamp(seconds float64) string {
	centiseconds := int64(math.Round(math.Max(0, seconds) * 100))
	return fmt.Sprintf("%d:%02d:%02d.%02d",
		centiseconds/360000,
		(centiseconds%360000)/6000,
		(centiseconds%6000)/100,
		centiseconds%100,
	)
}

func escapeASSText(text string) string {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	// Braces introduce ASS override commands. Replacing them keeps imported or
	// edited text from changing the renderer configuration.
	text = strings.NewReplacer(
		"{", "(",
		"}", ")",
		"\\N", "\\N",
		"\n", "\\N",
	).Replace(text)
	return text
}

func buildASS(cues []SubtitleCue, rawStyle SubtitleStyle) string {
	style := normalizeSubtitleStyle(rawStyle)
	backgroundAlpha := byte(math.Round((1 - style.BackgroundOpacity) * 255))
	backgroundPadding := max(6, style.OutlineWidth+4)
	alignment := 2
	marginV := 72
	switch style.Position {
	case "top":
		alignment = 8
		marginV = 64
	case "center":
		alignment = 5
		marginV = 0
	}
	bold := 0
	if style.Bold {
		bold = -1
	}
	italic := 0
	if style.Italic {
		italic = -1
	}

	var builder strings.Builder
	builder.WriteString("[Script Info]\n")
	builder.WriteString("ScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\nScaledBorderAndShadow: yes\nYCbCr Matrix: TV.709\n\n")
	builder.WriteString("[V4+ Styles]\n")
	builder.WriteString("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
	fmt.Fprintf(&builder,
		"Style: Background,%s,%d,%s,%s,%s,%s,%d,%d,0,0,100,100,0,0,3,%d,0,%d,70,70,%d,1\n",
		style.FontFamily,
		style.FontSize,
		assColor(style.TextColor, 255),
		assColor(style.TextColor, 255),
		assColor(style.BackgroundColor, backgroundAlpha),
		assColor(style.BackgroundColor, 255),
		bold,
		italic,
		backgroundPadding,
		alignment,
		marginV,
	)
	fmt.Fprintf(&builder,
		"Style: Default,%s,%d,%s,%s,%s,%s,%d,%d,0,0,100,100,0,0,1,%d,0,%d,70,70,%d,1\n\n",
		style.FontFamily,
		style.FontSize,
		assColor(style.TextColor, 0),
		assColor(style.TextColor, 0),
		assColor(style.OutlineColor, 0),
		assColor(style.BackgroundColor, 255),
		bold,
		italic,
		style.OutlineWidth,
		alignment,
		marginV,
	)
	builder.WriteString("[Events]\n")
	builder.WriteString("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
	for _, cue := range normalizeSubtitleCues(cues) {
		text := escapeASSText(cue.Text)
		if style.BackgroundOpacity > 0.001 {
			fmt.Fprintf(&builder, "Dialogue: 0,%s,%s,Background,,0,0,0,,%s\n",
				assTimestamp(cue.Start), assTimestamp(cue.End), text)
		}
		fmt.Fprintf(&builder, "Dialogue: 1,%s,%s,Default,,0,0,0,,%s\n",
			assTimestamp(cue.Start), assTimestamp(cue.End), text)
	}
	return builder.String()
}

func writeASSFile(workspace string, cues []SubtitleCue, style SubtitleStyle) (string, error) {
	if len(cues) == 0 {
		return "", errors.New("cannot render an empty subtitle track")
	}
	path := filepath.Join(workspace, "downkingo-captions.ass")
	if err := os.WriteFile(path, []byte(buildASS(cues, style)), 0600); err != nil {
		return "", err
	}
	return path, nil
}

func escapeFFmpegFilterPath(path string) string {
	path = filepath.ToSlash(path)
	path = strings.NewReplacer(
		"\\", "\\\\",
		":", "\\:",
		"'", "\\'",
		"[", "\\[",
		"]", "\\]",
		",", "\\,",
		";", "\\;",
	).Replace(path)
	return "'" + path + "'"
}

func appendASSFilter(filter, inputLabel, outputLabel, assPath string) string {
	assFilter := fmt.Sprintf("[%s]ass=filename=%s[%s]", inputLabel, escapeFFmpegFilterPath(assPath), outputLabel)
	if strings.TrimSpace(filter) == "" {
		return assFilter
	}
	return filter + ";" + assFilter
}

func validCaptionOptions(options CaptionOptions) CaptionOptions {
	options.Source = normalizeCaptionSource(options.Source)
	options.Language = sanitizeSubtitleLanguage(options.Language)
	options.Model = strings.TrimSpace(options.Model)
	if len(options.Model) > 64 || strings.ContainsAny(options.Model, `/\\`) {
		options.Model = ""
	}
	options.Cues = normalizeSubtitleCues(options.Cues)
	options.Style = normalizeSubtitleStyle(options.Style)
	return options
}

func outputExtension(opts DownloadOptions) string {
	if opts.AudioOnly {
		allowed := map[string]bool{"mp3": true, "m4a": true, "opus": true, "flac": true, "wav": true, "ogg": true}
		format := strings.ToLower(opts.AudioFormat)
		if !allowed[format] {
			format = "mp3"
		}
		return "." + format
	}
	if strings.EqualFold(opts.RemuxFormat, "mkv") {
		return ".mkv"
	}
	return ".mp4"
}

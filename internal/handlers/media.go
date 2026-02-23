package handlers

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	apperr "kingo/internal/errors"
	"kingo/internal/images"
	"kingo/internal/instagram"
	"kingo/internal/logger"
	"kingo/internal/ratelimit"
	"kingo/internal/twitter"
	"kingo/internal/validate"
	"kingo/internal/youtube"
)

// MediaInfo representa múltiplas mídias (para carrosseis do Instagram).
type MediaInfo struct {
	OriginalURL string         `json:"originalUrl"`
	MediaItems  []MediaItemDTO `json:"mediaItems"`
	Source      string         `json:"source"` // "instagram", "twitter", etc
}

// MediaItemDTO representa uma mídia individual.
type MediaItemDTO struct {
	URL    string `json:"url"`
	Type   string `json:"type"` // "image" ou "video"
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// MediaHandler encapsulates all media-related operations (images, Instagram, Twitter).
type MediaHandler struct {
	ctx            context.Context
	imageClient    *images.Client
	youtube        *youtube.Client
	consoleEmitter func(string)
}

// NewMediaHandler creates a new MediaHandler with dependencies.
func NewMediaHandler(imgClient *images.Client, yt *youtube.Client) *MediaHandler {
	return &MediaHandler{
		ctx:            context.Background(),
		imageClient:    imgClient,
		youtube:        yt,
		consoleEmitter: func(s string) {},
	}
}

// SetContext injects the Wails runtime context.
func (h *MediaHandler) SetContext(ctx context.Context) {
	h.ctx = ctx
}

// SetConsoleEmitter sets the function to emit user-friendly console logs.
func (h *MediaHandler) SetConsoleEmitter(emitter func(string)) {
	h.consoleEmitter = emitter
}

func (h *MediaHandler) consoleLog(message string) {
	if h.consoleEmitter != nil {
		h.consoleEmitter(message)
	}
}

// IsSocialMediaURL verifica se é uma URL de rede social que precisa de auth.
func IsSocialMediaURL(url string) bool {
	lowerURL := strings.ToLower(url)
	if strings.Contains(lowerURL, "cdninstagram.com") ||
		strings.Contains(lowerURL, "fbcdn.net") ||
		strings.HasSuffix(lowerURL, ".jpg") ||
		strings.HasSuffix(lowerURL, ".jpeg") ||
		strings.HasSuffix(lowerURL, ".png") ||
		strings.HasSuffix(lowerURL, ".webp") {
		return false
	}

	socialDomains := []string{
		"instagram.com",
		"twitter.com",
		"x.com",
		"tiktok.com",
		"facebook.com",
		"threads.net",
	}
	for _, domain := range socialDomains {
		if strings.Contains(lowerURL, domain) {
			return true
		}
	}
	return false
}

// GetInstagramCarousel retorna TODAS as imagens de um carrossel do Instagram.
// Validates URL and applies rate limiting to prevent API abuse.
func (h *MediaHandler) GetInstagramCarousel(url string) (*MediaInfo, error) {
	const op = "MediaHandler.GetInstagramCarousel"
	startTime := time.Now()

	// Validate URL
	if _, err := validate.URL(url); err != nil {
		return nil, apperr.Wrap(op, err)
	}

	if !strings.Contains(url, "instagram.com") {
		return nil, apperr.NewWithMessage(op, apperr.ErrInvalidURL, "URL não é do Instagram")
	}

	// Rate limiting to prevent Instagram blocking
	if !ratelimit.InstagramLimiter.Allow() {
		h.consoleLog("[Instagram] ⚠ Aguardando rate limit...")
		if err := ratelimit.InstagramLimiter.Wait(h.ctx); err != nil {
			return nil, apperr.Wrap(op, err)
		}
	}

	h.consoleLog("[Instagram] Buscando imagens do post...")
	logger.Log.Info().Str("url", url).Msg("extracting instagram carousel")
	var items []MediaItemDTO

	// ESTRATÉGIA 1: Scraper Nativo
	if info, err := instagram.GetPostInfo(url); err == nil && len(info.MediaItems) > 0 {
		elapsed := time.Since(startTime).Seconds()
		logger.Log.Info().Int("count", len(info.MediaItems)).Msg("native scraper success")
		for _, item := range info.MediaItems {
			u := item.DisplayURL
			if u == "" {
				u = item.URL
			}
			items = append(items, MediaItemDTO{
				URL:    u,
				Type:   item.Type,
				Width:  item.Width,
				Height: item.Height,
			})
		}
		h.consoleLog(fmt.Sprintf("[Instagram] ✓ %d imagens encontradas (%.1fs) via Scraper", len(info.MediaItems), elapsed))
		return h.finalizeCarousel(url, items), nil
	}

	// ESTRATÉGIA 2: yt-dlp (fallback robusto)
	if h.youtube != nil {
		if videoInfos, err := h.youtube.GetPlaylistInfo(context.Background(), url); err == nil && len(videoInfos) > 0 {
			elapsed := time.Since(startTime).Seconds()
			logger.Log.Info().Int("count", len(videoInfos)).Msg("yt-dlp success")
			for _, info := range videoInfos {
				itemUrl := info.URL
				if itemUrl == "" && len(info.Formats) > 0 {
					itemUrl = info.Formats[len(info.Formats)-1].URL
				}
				if itemUrl == "" && strings.HasPrefix(info.Thumbnail, "http") {
					itemUrl = info.Thumbnail
				}

				tipo := "image"
				if info.Duration > 0 {
					tipo = "video"
				}

				width := info.Width
				height := info.Height
				if width == 0 && len(info.Formats) > 0 {
					last := info.Formats[len(info.Formats)-1]
					width = last.Width
					height = last.Height
				}

				items = append(items, MediaItemDTO{
					URL:    itemUrl,
					Type:   tipo,
					Width:  width,
					Height: height,
				})
			}
			h.consoleLog(fmt.Sprintf("[Instagram] ✓ %d imagens encontradas (%.1fs) via YT-DLP", len(videoInfos), elapsed))
			return h.finalizeCarousel(url, items), nil
		}
	}

	elapsed := time.Since(startTime).Seconds()
	h.consoleLog(fmt.Sprintf("[Instagram] ✗ Falha ao extrair imagens (%.1fs)", elapsed))
	return nil, fmt.Errorf("falha ao extrair carrossel do Instagram")
}

func (h *MediaHandler) finalizeCarousel(url string, items []MediaItemDTO) *MediaInfo {
	deduped := deduplicateMediaItems(items)
	return &MediaInfo{
		OriginalURL: url,
		Source:      "instagram",
		MediaItems:  deduped,
	}
}

// deduplicateMediaItems removes duplicate images from Instagram carousels.
// Instagram often returns the same image in multiple resolutions/sizes.
// This function:
// 1. Uses the filename (without query params) as a unique key
// 2. Prefers higher resolution images (width * height)
// 3. Prefers full-size URLs over resized ones (URLs containing "/s" are typically thumbnails)
func deduplicateMediaItems(items []MediaItemDTO) []MediaItemDTO {
	unique := make(map[string]MediaItemDTO)
	keys := []string{}

	for _, item := range items {
		parts := strings.Split(item.URL, "/")
		if len(parts) == 0 {
			continue
		}
		filename := parts[len(parts)-1]
		if idx := strings.Index(filename, "?"); idx != -1 {
			filename = filename[:idx]
		}
		key := filename

		if existing, exists := unique[key]; exists {
			currentScore := item.Width * item.Height
			existingScore := existing.Width * existing.Height
			if currentScore > existingScore {
				unique[key] = item
			} else if currentScore == existingScore {
				// Prefer non-resized URLs (those without "/s" in path)
				if strings.Contains(existing.URL, "/s") && !strings.Contains(item.URL, "/s") {
					unique[key] = item
				}
			}
		} else {
			unique[key] = item
			keys = append(keys, key)
		}
	}

	result := make([]MediaItemDTO, 0, len(keys))
	for _, key := range keys {
		result = append(result, unique[key])
	}
	return result
}

// GetImageInfo fetches metadata for an image URL.
func (h *MediaHandler) GetImageInfo(url string) (*images.ImageInfo, error) {
	logger.Log.Info().Str("url", url).Msg("getting image info")

	if IsSocialMediaURL(url) && h.youtube != nil {
		return h.getImageInfoFromSocialMedia(url)
	}

	// 1. Tentar scraper direto
	info, err := h.imageClient.ExtractImage(url)
	if err == nil {
		return info, nil
	}

	// 2. Fallback: YT-DLP
	if h.youtube != nil {
		videoInfo, err2 := h.youtube.GetVideoInfo(context.Background(), url)
		if err2 == nil && videoInfo.Thumbnail != "" {
			return h.convertVideoInfoToImageInfo(url, videoInfo), nil
		}
	}

	return nil, err
}

func (h *MediaHandler) getImageInfoFromSocialMedia(url string) (*images.ImageInfo, error) {
	startTime := time.Now()
	h.consoleLog("[Imagem] Buscando imagem da rede social...")

	// ESTRATÉGIA 1: Módulo nativo de Instagram
	if strings.Contains(url, "instagram.com") {
		imageURL, err := instagram.GetFirstImageURL(url)
		if err == nil && imageURL != "" {
			elapsed := time.Since(startTime).Seconds()
			h.consoleLog(fmt.Sprintf("[Instagram] ✓ Imagem encontrada (%.1fs) via Scraper", elapsed))
			return &images.ImageInfo{
				OriginalURL: url,
				DirectURL:   imageURL,
				Filename:    "instagram_image.jpg",
				ContentType: "image/jpeg",
				Size:        0,
			}, nil
		}
	}

	// ESTRATÉGIA 2: Módulo nativo de Twitter/X
	if strings.Contains(url, "twitter.com") || strings.Contains(url, "x.com") {
		imageURL, err := twitter.GetFirstImageURL(url)
		if err == nil && imageURL != "" {
			elapsed := time.Since(startTime).Seconds()
			h.consoleLog(fmt.Sprintf("[Twitter] ✓ Imagem encontrada (%.1fs) via Scraper", elapsed))
			return &images.ImageInfo{
				OriginalURL: url,
				DirectURL:   imageURL,
				Filename:    "twitter_image.jpg",
				ContentType: "image/jpeg",
				Size:        0,
			}, nil
		}
	}

	// ESTRATÉGIA 3: YT-DLP com cookies
	browsers := []string{"chrome", "firefox"}
	var lastErr error
	for _, browser := range browsers {
		videoInfo, err := h.youtube.GetVideoInfoWithCookies(context.Background(), url, browser)
		if err == nil && videoInfo.Thumbnail != "" {
			elapsed := time.Since(startTime).Seconds()
			h.consoleLog(fmt.Sprintf("[Imagem] ✓ Imagem encontrada (%.1fs) via YT-DLP", elapsed))
			return h.convertVideoInfoToImageInfo(url, videoInfo), nil
		}
		lastErr = err
	}

	// ESTRATÉGIA 4: YT-DLP sem cookies
	videoInfoPublic, errPublic := h.youtube.GetVideoInfo(context.Background(), url)
	if errPublic == nil && videoInfoPublic.Thumbnail != "" {
		elapsed := time.Since(startTime).Seconds()
		h.consoleLog(fmt.Sprintf("[Imagem] ✓ Imagem encontrada (%.1fs) via YT-DLP", elapsed))
		return h.convertVideoInfoToImageInfo(url, videoInfoPublic), nil
	}

	elapsed := time.Since(startTime).Seconds()
	h.consoleLog(fmt.Sprintf("[Imagem] ✗ Falha ao buscar imagem (%.1fs)", elapsed))
	if lastErr != nil {
		return nil, fmt.Errorf("falha de autenticação: o site bloqueou o acesso automático")
	}
	return nil, fmt.Errorf("conteúdo não encontrado ou acesso bloqueado")
}

func (h *MediaHandler) convertVideoInfoToImageInfo(originalURL string, videoInfo *youtube.VideoInfo) *images.ImageInfo {
	ext := ".jpg"
	if strings.Contains(videoInfo.Thumbnail, ".webp") {
		ext = ".webp"
	} else if strings.Contains(videoInfo.Thumbnail, ".png") {
		ext = ".png"
	}

	title := videoInfo.Title
	if title == "" {
		title = videoInfo.ID
	}
	if title == "" {
		title = fmt.Sprintf("image_%d", time.Now().Unix())
	}

	re := regexp.MustCompile(`[<>:"/\\|?*]`)
	safeTitle := re.ReplaceAllString(title, "_")
	if len(safeTitle) > 100 {
		safeTitle = safeTitle[:100]
	}
	filename := safeTitle + ext

	return &images.ImageInfo{
		OriginalURL: originalURL,
		DirectURL:   videoInfo.Thumbnail,
		Filename:    filename,
		ContentType: "image/jpeg",
		Size:        0,
	}
}

// DownloadImage downloads an image to the specified directory.
func (h *MediaHandler) DownloadImage(url, filename, imagesDir, ffmpegPath, avifencPath, format string, quality int) (string, error) {
	startTime := time.Now()
	h.consoleLog(fmt.Sprintf("[Download] Baixando imagem: %s", filename))

	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return "", err
	}

	filename = filepath.Base(filename)
	destPath := filepath.Join(imagesDir, filename)

	if err := h.imageClient.DownloadImage(url, destPath); err != nil {
		elapsed := time.Since(startTime).Seconds()
		h.consoleLog(fmt.Sprintf("[Download] ✗ Falha ao baixar imagem (%.1fs)", elapsed))
		return "", err
	}

	finalPath, err := images.Convert(destPath, format, quality, ffmpegPath, avifencPath)
	if err != nil {
		logger.Log.Error().Err(err).Msg("failed to convert image")
		return destPath, nil
	}

	elapsed := time.Since(startTime).Seconds()
	h.consoleLog(fmt.Sprintf("[Download] ✓ Imagem salva em %s (%.1fs)", strings.ToUpper(format), elapsed))
	return finalPath, nil
}

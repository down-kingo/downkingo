package twitter

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// TweetMedia representa uma mídia extraída de um tweet
type TweetMedia struct {
	URL    string `json:"url"`
	Type   string `json:"type"` // "photo" ou "video"
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// TweetInfo representa informações extraídas de um tweet
type TweetInfo struct {
	ID         string       `json:"id"`
	Text       string       `json:"text"`
	AuthorName string       `json:"author_name"`
	MediaItems []TweetMedia `json:"media_items"`
}

var (
	// Regex para extrair ID do tweet da URL
	tweetIDRegex = regexp.MustCompile(`(?:twitter\.com|x\.com)/[^/]+/status/(\d+)`)

	// Regex para extrair media_url_https do HTML/JSON
	mediaURLRegex = regexp.MustCompile(`"media_url_https"\s*:\s*"([^"]+)"`)

	// Regex alternativo para og:image
	ogImageRegex  = regexp.MustCompile(`<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']`)
	ogImageRegex2 = regexp.MustCompile(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']`)

	// User-Agent que simula o Googlebot
	botUserAgent = "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)

// ExtractTweetID extrai o ID do tweet de uma URL
func ExtractTweetID(url string) (string, error) {
	matches := tweetIDRegex.FindStringSubmatch(url)
	if len(matches) < 2 {
		return "", errors.New("ID do tweet não encontrado na URL")
	}
	return matches[1], nil
}

// GetTweetInfo extrai informações de um tweet dado a URL
func GetTweetInfo(tweetURL string) (*TweetInfo, error) {
	tweetID, err := ExtractTweetID(tweetURL)
	if err != nil {
		return nil, err
	}

	// Tentar a API de Syndication primeiro (mais confiável quando disponível)
	info, err := getTweetFromSyndication(tweetID)
	if err == nil && len(info.MediaItems) > 0 {
		return info, nil
	}

	// Fallback: Scraping direto da página com User-Agent de bot
	info, err = getTweetFromHTML(tweetURL, tweetID)
	if err == nil && len(info.MediaItems) > 0 {
		return info, nil
	}

	return nil, errors.New("não foi possível extrair mídia do tweet")
}

// getTweetFromSyndication tenta obter dados do tweet via API de Syndication
func getTweetFromSyndication(tweetID string) (*TweetInfo, error) {
	apiURL := fmt.Sprintf("https://cdn.syndication.twimg.com/tweet-result?id=%s&token=x", tweetID)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("syndication API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}

	info := &TweetInfo{ID: tweetID}

	// Extrair texto
	if text, ok := data["text"].(string); ok {
		info.Text = text
	}

	// Extrair autor
	if user, ok := data["user"].(map[string]interface{}); ok {
		if name, ok := user["name"].(string); ok {
			info.AuthorName = name
		}
	}

	// Extrair fotos
	if photos, ok := data["photos"].([]interface{}); ok {
		for _, p := range photos {
			if pMap, ok := p.(map[string]interface{}); ok {
				media := TweetMedia{Type: "photo"}
				if url, ok := pMap["url"].(string); ok {
					media.URL = url
				}
				if w, ok := pMap["width"].(float64); ok {
					media.Width = int(w)
				}
				if h, ok := pMap["height"].(float64); ok {
					media.Height = int(h)
				}
				if media.URL != "" {
					info.MediaItems = append(info.MediaItems, media)
				}
			}
		}
	}

	// Extrair mediaDetails (formato alternativo)
	if mediaDetails, ok := data["mediaDetails"].([]interface{}); ok {
		for _, m := range mediaDetails {
			if mMap, ok := m.(map[string]interface{}); ok {
				media := TweetMedia{}
				if mediaURL, ok := mMap["media_url_https"].(string); ok {
					media.URL = mediaURL
				}
				if mediaType, ok := mMap["type"].(string); ok {
					media.Type = mediaType
				}
				if media.URL != "" {
					info.MediaItems = append(info.MediaItems, media)
				}
			}
		}
	}

	return info, nil
}

// getTweetFromHTML faz scraping direto da página do Twitter
func getTweetFromHTML(tweetURL, tweetID string) (*TweetInfo, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", tweetURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", botUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.5")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Twitter returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
	if err != nil {
		return nil, err
	}
	html := string(body)

	info := &TweetInfo{ID: tweetID}

	// Tentar extrair og:image primeiro
	if matches := ogImageRegex.FindStringSubmatch(html); len(matches) >= 2 {
		url := unescapeHTML(matches[1])
		if isValidTwitterMediaURL(url) {
			info.MediaItems = append(info.MediaItems, TweetMedia{
				URL:  url,
				Type: "photo",
			})
		}
	}

	if len(info.MediaItems) == 0 {
		if matches := ogImageRegex2.FindStringSubmatch(html); len(matches) >= 2 {
			url := unescapeHTML(matches[1])
			if isValidTwitterMediaURL(url) {
				info.MediaItems = append(info.MediaItems, TweetMedia{
					URL:  url,
					Type: "photo",
				})
			}
		}
	}

	// Fallback: extrair media_url_https do JSON embutido
	if len(info.MediaItems) == 0 {
		if matches := mediaURLRegex.FindAllStringSubmatch(html, -1); len(matches) > 0 {
			seen := make(map[string]bool)
			for _, match := range matches {
				if len(match) >= 2 {
					url := unescapeJSON(match[1])
					if isValidTwitterMediaURL(url) && !seen[url] {
						seen[url] = true
						info.MediaItems = append(info.MediaItems, TweetMedia{
							URL:  url,
							Type: "photo",
						})
					}
				}
			}
		}
	}

	return info, nil
}

// GetFirstImageURL é um helper que retorna apenas a URL da primeira imagem
func GetFirstImageURL(tweetURL string) (string, error) {
	info, err := GetTweetInfo(tweetURL)
	if err != nil {
		return "", err
	}
	if len(info.MediaItems) == 0 {
		return "", errors.New("nenhuma mídia encontrada no tweet")
	}
	return info.MediaItems[0].URL, nil
}

// isValidTwitterMediaURL verifica se a URL é uma mídia válida do Twitter
func isValidTwitterMediaURL(url string) bool {
	return strings.Contains(url, "pbs.twimg.com") ||
		strings.Contains(url, "video.twimg.com") ||
		strings.Contains(url, "abs.twimg.com")
}

// unescapeJSON remove escapes de JSON
func unescapeJSON(s string) string {
	s = strings.ReplaceAll(s, `\/`, `/`)
	s = strings.ReplaceAll(s, `\u0026`, `&`)
	return s
}

// unescapeHTML remove entidades HTML
func unescapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", `"`)
	return s
}

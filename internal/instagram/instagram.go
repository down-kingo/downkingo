package instagram

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// PostMedia representa uma mídia extraída de um post do Instagram
type PostMedia struct {
	URL        string `json:"url"`
	Type       string `json:"type"` // "image" ou "video"
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	DisplayURL string `json:"display_url"`
	VideoURL   string `json:"video_url,omitempty"`
}

// PostInfo representa informações extraídas de um post do Instagram
type PostInfo struct {
	Shortcode  string      `json:"shortcode"`
	Caption    string      `json:"caption"`
	MediaItems []PostMedia `json:"media_items"`
	OwnerName  string      `json:"owner_name"`
	Timestamp  int64       `json:"timestamp"`
}

var (
	shortcodeRegex  = regexp.MustCompile(`instagram\.com/(?:p|reel|reels)/([A-Za-z0-9_-]+)`)
	displayURLRegex = regexp.MustCompile(`"display_url"\s*:\s*"([^"]+)"`)
	// Regex para og:image
	ogImageRegex  = regexp.MustCompile(`property="og:image"\s+content="([^"]+)"`)
	ogImageRegex2 = regexp.MustCompile(`content="([^"]+)"\s+property="og:image"`)

	// Regex para imagens de alta resolução do Instagram (dst-jpg_e35 = sem crop)
	// Restaurado com proteções para evitar lixo do feed
	fullResImageRegex = regexp.MustCompile(`"url"\s*:\s*"(https:\\/\\/[^"]*cdninstagram[^"]*(?:dst-(?:jpg|jpegr)_e35(?:_tt6)?)[^"]*)"`)

	// Regex para detectar URLs de avatar (para filtrar)
	avatarRegex = regexp.MustCompile(`/\d+x\d+/`)
)

// ExtractShortcode extrai o shortcode de uma URL do Instagram
func ExtractShortcode(url string) (string, error) {
	matches := shortcodeRegex.FindStringSubmatch(url)
	if len(matches) < 2 {
		return "", errors.New("shortcode não encontrado na URL")
	}
	return matches[1], nil
}

// GetPostInfo extrai informações de um post do Instagram
// Nota: Desde dezembro/2024, o Instagram bloqueia acessos anônimos na maioria dos casos
func GetPostInfo(postURL string) (*PostInfo, error) {
	shortcode, err := ExtractShortcode(postURL)
	if err != nil {
		return nil, err
	}

	// Tentar scraping com User-Agent de bot (funciona para alguns posts públicos)
	return getPostInfoAnonymous(shortcode, postURL)
}

// getPostInfoAnonymous tenta extrair informações sem autenticação
func getPostInfoAnonymous(shortcode, postURL string) (*PostInfo, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	// Construir URL canônica
	canonicalURL := fmt.Sprintf("https://www.instagram.com/p/%s/", shortcode)

	// Criar requisição com headers de navegador real (NÃO BOT) para receber o HTML completo da SPA
	req, err := http.NewRequest("GET", canonicalURL, nil)
	if err != nil {
		return nil, err
	}

	// User-Agent de PC moderno (Chrome/Windows)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "none")
	req.Header.Set("Upgrade-Insecure-Requests", "1")
	req.Header.Set("Connection", "keep-alive")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Instagram retornou status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
	if err != nil {
		return nil, err
	}

	html := string(body)
	info := &PostInfo{Shortcode: shortcode}
	seen := make(map[string]bool)

	const maxCarouselImages = 20 // Limite generoso para carrossel

	// Limitar busca à primeira parte do HTML (post principal, não relacionados)
	// Posts relacionados geralmente aparecem no final do HTML
	searchHTML := html
	if len(html) > 80000 {
		searchHTML = html[:len(html)*85/100]
	}

	// === ESTRATÉGIA 1: Extrair imagens de alta resolução (carrossel) ===
	// Busca por URLs com padrão dst-jpg_e35 que são imagens em resolução original
	fullResMatches := fullResImageRegex.FindAllStringSubmatch(searchHTML, maxCarouselImages*6) // Margem para variantes
	for _, match := range fullResMatches {
		if len(info.MediaItems) >= maxCarouselImages {
			break // Limite atingido
		}

		url := unescapeJSON(match[1])

		// Filtrar avatares e thumbnails pequenos (ex: /150x150/)
		if avatarRegex.MatchString(url) {
			continue
		}

		// Filtrar URLs muito curtas (provavelmente inválidas)
		if len(url) < 50 {
			continue
		}

		// Extrair filename para normalização
		parts := strings.Split(url, "/")
		if len(parts) == 0 {
			continue
		}
		filename := parts[len(parts)-1]
		if idx := strings.Index(filename, "?"); idx != -1 {
			filename = filename[:idx]
		}

		// Deduplicar por filename (mesmo arquivo = mesma imagem)
		if seen[filename] {
			continue
		}
		seen[filename] = true

		if isValidCDNUrl(url) {
			info.MediaItems = append(info.MediaItems, PostMedia{
				URL:        url,
				DisplayURL: url,
				Type:       "image",
			})
		}
	}

	// Se encontrou imagens, retornar (sucesso!)
	if len(info.MediaItems) > 0 {
		return info, nil
	}

	// === FALLBACKS (quando a estratégia principal falha) ===

	// Fallback 1: display_url do JSON
	matches := displayURLRegex.FindAllStringSubmatch(html, -1)
	for _, match := range matches {
		url := upgradeImageURL(unescapeJSON(match[1]))
		if isValidCDNUrl(url) && !seen[url] {
			seen[url] = true
			info.MediaItems = append(info.MediaItems, PostMedia{
				URL:        url,
				DisplayURL: url,
				Type:       "image",
			})
		}
	}

	// 2. Se falhar, tentar twitter:image (geralmente formato original, não quadrado)
	if len(info.MediaItems) == 0 {
		// Tentar ambas as ordens de atributos para garantir
		twitterRegex1 := regexp.MustCompile(`name="twitter:image"\s+content="([^"]+)"`)
		twitterRegex2 := regexp.MustCompile(`content="([^"]+)"\s+name="twitter:image"`)

		var url string
		if matches := twitterRegex1.FindStringSubmatch(html); len(matches) >= 2 {
			url = upgradeImageURL(unescapeHTML(matches[1]))
		} else if matches := twitterRegex2.FindStringSubmatch(html); len(matches) >= 2 {
			url = upgradeImageURL(unescapeHTML(matches[1]))
		}

		if url != "" && isValidCDNUrl(url) {
			info.MediaItems = append(info.MediaItems, PostMedia{
				URL:        url,
				DisplayURL: url,
				Type:       "image",
			})
		}
	}

	// 3. Se falhar, tentar og:image (pode ser corte quadrado)
	if len(info.MediaItems) == 0 {
		if matches := ogImageRegex.FindStringSubmatch(html); len(matches) >= 2 {
			url := upgradeImageURL(unescapeHTML(matches[1]))
			if isValidCDNUrl(url) {
				info.MediaItems = append(info.MediaItems, PostMedia{
					URL:        url,
					DisplayURL: url,
					Type:       "image",
				})
			}
		}
	}

	if len(info.MediaItems) == 0 {
		if matches := ogImageRegex2.FindStringSubmatch(html); len(matches) >= 2 {
			url := upgradeImageURL(unescapeHTML(matches[1]))
			if isValidCDNUrl(url) {
				info.MediaItems = append(info.MediaItems, PostMedia{
					URL:        url,
					DisplayURL: url,
					Type:       "image",
				})
			}
		}
	}

	if len(info.MediaItems) == 0 {
		return nil, errors.New("não foi possível extrair mídia do post - Instagram exige login desde dezembro/2024")
	}

	return info, nil
}

// GetFirstImageURL é um helper que retorna apenas a URL da primeira imagem
func GetFirstImageURL(postURL string) (string, error) {
	info, err := GetPostInfo(postURL)
	if err != nil {
		return "", err
	}
	if len(info.MediaItems) == 0 {
		return "", errors.New("nenhuma mídia encontrada no post")
	}

	// Preferir display_url sobre url
	if info.MediaItems[0].DisplayURL != "" {
		return info.MediaItems[0].DisplayURL, nil
	}
	return info.MediaItems[0].URL, nil
}

// isValidCDNUrl verifica se é uma URL válida de CDN do Instagram
func isValidCDNUrl(url string) bool {
	return strings.Contains(url, "cdninstagram") ||
		strings.Contains(url, "fbcdn") ||
		strings.Contains(url, "scontent")
}

// unescapeJSON remove escapes de JSON de uma string
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

// upgradeImageURL tenta remover parâmetros de crop/resize da URL para obter a original
func upgradeImageURL(url string) string {
	// Remover crop (ex: /c135.0.810.810a/)
	cropRegex := regexp.MustCompile(`\/c\d+\.\d+\.\d+\.\d+(?:a|p)?\/`)
	url = cropRegex.ReplaceAllString(url, "/")

	// Remover resize (ex: /s640x640/, /p640x640/)
	resizeRegex := regexp.MustCompile(`\/(?:s|p|e)\d+x\d+\/`)
	url = resizeRegex.ReplaceAllString(url, "/")

	// Nota: Nem sempre remover funciona, às vezes dá 403.
	// Mas para og:image geralmente funciona se remover o crop.
	// Vamos ser conservadores: apenas remover crop se for explícito (cXXX...).
	// Resize (s640x640) muitas vezes é necessário para o path existir em CDN antiga.
	// Mas em CDNs novas (dst-jpg_e35), o resize é parte do nome.

	// Melhor estratégia: Se tiver /s640x640/, tentar remover.

	return url
}

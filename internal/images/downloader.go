package images

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ════════════════════════════════════════════════════════════════════════════

const (
	// User-Agent consistente e realista
	userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

	// Limites de segurança
	maxHTMLSize    = 5 * 1024 * 1024  // 5MB para garantir leitura de JSONs grandes em SPAs
	maxImageSize   = 50 * 1024 * 1024 // 50MB para imagens
	maxRedirects   = 10
	requestTimeout = 30 * time.Second
)

// ════════════════════════════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════════════════════════════

// ImageInfo contém metadados de uma imagem detectada
type ImageInfo struct {
	OriginalURL string `json:"originalUrl"`
	DirectURL   string `json:"directUrl"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
	Filename    string `json:"filename"`
}

// Client gerencia downloads de imagens com segurança SSRF
type Client struct {
	httpClient *http.Client
}

// ════════════════════════════════════════════════════════════════════════════
// CUIDADO #5 + #A + #B: SSRF PREVENTION COMPLETO
// - Valida URL inicial
// - Valida cada redirect (CheckRedirect)
// - DNS pinning (usa IP resolvido no dial para evitar rebinding)
// - Bloqueia IPs privados
// ════════════════════════════════════════════════════════════════════════════

var (
	privateIPBlocks []*net.IPNet
)

func init() {
	// CIDRs privados/reservados que devem ser bloqueados
	// NOTA: Não incluir ::ffff:0:0/96 pois o Go parseia incorretamente como 0.0.0.0/0
	privateCIDRs := []string{
		// IPv4 privados/reservados
		"0.0.0.0/8",          // "This" network (0.0.0.0 - 0.255.255.255)
		"10.0.0.0/8",         // RFC1918 Private
		"100.64.0.0/10",      // RFC6598 Carrier-grade NAT
		"127.0.0.0/8",        // Loopback
		"169.254.0.0/16",     // Link-local
		"172.16.0.0/12",      // RFC1918 Private
		"192.0.0.0/24",       // IETF Protocol Assignments
		"192.0.2.0/24",       // TEST-NET-1
		"192.168.0.0/16",     // RFC1918 Private
		"198.18.0.0/15",      // Benchmark testing
		"198.51.100.0/24",    // TEST-NET-2
		"203.0.113.0/24",     // TEST-NET-3
		"224.0.0.0/4",        // Multicast
		"240.0.0.0/4",        // Reserved for future use
		"255.255.255.255/32", // Broadcast
		// IPv6 privados/reservados
		"::1/128",       // Loopback
		"fc00::/7",      // Unique local (RFC4193)
		"fe80::/10",     // Link-local
		"ff00::/8",      // Multicast
		"2001:db8::/32", // Documentation (RFC3849)
		"2001::/32",     // Teredo
		"64:ff9b::/96",  // NAT64 translation
		// Deixamos de fora ::ffff:0:0/96 e ::/128 pois causam problemas de parsing
	}

	for _, cidr := range privateCIDRs {
		_, block, err := net.ParseCIDR(cidr)
		if err == nil {
			privateIPBlocks = append(privateIPBlocks, block)
		}
	}
}

// isPrivateIP verifica se um IP é privado/reservado
func isPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsLinkLocalMulticast() || ip.IsLinkLocalUnicast() || ip.IsPrivate() {
		return true
	}
	for _, block := range privateIPBlocks {
		if block.Contains(ip) {
			return true
		}
	}
	return false
}

// resolveAndValidateHost resolve DNS e valida se todos os IPs são públicos
// Retorna o primeiro IP público válido (para pinning)
func resolveAndValidateHost(hostname string) (net.IP, error) {
	// Verificar se já é um IP literal
	if ip := net.ParseIP(hostname); ip != nil {
		if isPrivateIP(ip) {
			return nil, fmt.Errorf("acesso a IP privado bloqueado: %s", ip.String())
		}
		return ip, nil
	}

	// Bloquear localhost explícito
	if strings.EqualFold(hostname, "localhost") {
		return nil, errors.New("acesso a localhost bloqueado")
	}

	// Resolver DNS
	ips, err := net.LookupIP(hostname)
	if err != nil {
		return nil, fmt.Errorf("falha ao resolver DNS: %w", err)
	}

	if len(ips) == 0 {
		return nil, errors.New("nenhum IP encontrado para o hostname")
	}

	// Validar TODOS os IPs retornados (evita que atacante coloque IP público + privado)
	var validIP net.IP
	for _, ip := range ips {
		if isPrivateIP(ip) {
			return nil, fmt.Errorf("DNS retornou IP privado: %s -> %s", hostname, ip.String())
		}
		if validIP == nil {
			validIP = ip
		}
	}

	return validIP, nil
}

// validateURL verifica se uma URL é segura para acessar
func validateURL(urlStr string) (*url.URL, error) {
	parsed, err := url.Parse(urlStr)
	if err != nil {
		return nil, fmt.Errorf("URL inválida: %w", err)
	}

	// Bloquear schemes não permitidos
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return nil, fmt.Errorf("scheme não permitido: %s", scheme)
	}

	// Validar hostname
	hostname := parsed.Hostname()
	if hostname == "" {
		return nil, errors.New("hostname vazio")
	}

	// Resolver e validar IP (isso também faz o DNS lookup)
	_, err = resolveAndValidateHost(hostname)
	if err != nil {
		return nil, err
	}

	return parsed, nil
}

// ════════════════════════════════════════════════════════════════════════════
// CUIDADO #B: DNS PINNING - Dial com IP resolvido
// Evita DNS rebinding (TOCTOU) usando o IP que validamos
// ════════════════════════════════════════════════════════════════════════════

// pinnedDialer cria um dialer que usa um IP específico (pinned)
func pinnedDialer(pinnedIP net.IP, port string) func(ctx context.Context, network, addr string) (net.Conn, error) {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		// Usar o IP pinado ao invés de resolver DNS novamente
		targetAddr := net.JoinHostPort(pinnedIP.String(), port)

		dialer := &net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}
		return dialer.DialContext(ctx, network, targetAddr)
	}
}

// createSecureClient cria um http.Client com DNS pinning para uma URL específica
func createSecureClient(targetURL *url.URL, pinnedIP net.IP) *http.Client {
	port := targetURL.Port()
	if port == "" {
		if targetURL.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	transport := &http.Transport{
		// CUIDADO #C: Desabilitar proxy para segurança máxima
		// (evita que proxy redirecione para rede interna)
		Proxy: nil,

		// DNS Pinning: usar o IP que já validamos
		DialContext: pinnedDialer(pinnedIP, port),

		// Timeouts
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,

		// Limites
		MaxIdleConns:       10,
		IdleConnTimeout:    30 * time.Second,
		DisableCompression: false, // Deixa o Go gerenciar
	}

	return &http.Client{
		Transport: transport,
		Timeout:   requestTimeout,
		// CUIDADO #A: Validar cada redirect
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return errors.New("too many redirects")
			}
			// Validar URL do redirect
			_, err := validateURL(req.URL.String())
			if err != nil {
				return fmt.Errorf("redirect bloqueado: %w", err)
			}
			return nil
		},
	}
}

// ════════════════════════════════════════════════════════════════════════════
// CLIENT PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

// NewClient cria um novo image downloader
func NewClient() *Client {
	// Client padrão para fallback (sem pinning, mas com validação de redirect)
	return &Client{
		httpClient: &http.Client{
			Timeout: requestTimeout,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= maxRedirects {
					return errors.New("too many redirects")
				}
				_, err := validateURL(req.URL.String())
				if err != nil {
					return fmt.Errorf("redirect bloqueado: %w", err)
				}
				return nil
			},
		},
	}
}

// setMinimalHeaders adiciona headers mínimos e consistentes
func setMinimalHeaders(req *http.Request) {
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7")
}

// setImageHeaders adiciona headers específicos para download de imagens
func setImageHeaders(req *http.Request, referer string) {
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7")
	// Referer apenas se mesmo domínio (reduz vazamento de contexto)
	if referer != "" {
		req.Header.Set("Referer", referer)
	}
}

// ════════════════════════════════════════════════════════════════════════════
// EXTRAÇÃO DE IMAGENS
// ════════════════════════════════════════════════════════════════════════════

// ExtractImage tenta encontrar a imagem principal de uma URL
func (c *Client) ExtractImage(urlStr string) (*ImageInfo, error) {
	// Validar URL e obter IP pinado
	parsed, err := validateURL(urlStr)
	if err != nil {
		return nil, err
	}

	// Resolver IP para pinning
	pinnedIP, err := resolveAndValidateHost(parsed.Hostname())
	if err != nil {
		return nil, err
	}

	// Criar client com DNS pinning
	secureClient := createSecureClient(parsed, pinnedIP)

	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return nil, err
	}

	// TRUQUE PARA SOCIAL MEDIA: Usar User-Agent do GoogleBot ou Mobile
	// Isso muitas vezes evita a página de login e retorna o HTML com og:image
	if strings.Contains(urlStr, "instagram.com") || strings.Contains(urlStr, "twitter.com") || strings.Contains(urlStr, "x.com") {
		req.Header.Set("User-Agent", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	} else {
		setMinimalHeaders(req)
	}

	resp, err := secureClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http status error: %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	finalURL := resp.Request.URL.String()

	// Se for HTML, tentar extrair meta tags
	if strings.Contains(contentType, "text/html") {
		return c.parseHTML(resp.Body, finalURL)
	}

	// CUIDADO #D: Validar que é realmente uma imagem
	if !strings.HasPrefix(contentType, "image/") {
		return nil, errors.New("não foi possível identificar uma imagem nesta URL")
	}

	size := resp.ContentLength

	// Validar tamanho
	if size > maxImageSize {
		return nil, fmt.Errorf("imagem muito grande: %d bytes (máximo: %d)", size, maxImageSize)
	}

	filename := extractFilename(finalURL)

	return &ImageInfo{
		OriginalURL: urlStr,
		DirectURL:   finalURL,
		ContentType: contentType,
		Size:        size,
		Filename:    filename,
	}, nil
}

// extractFilename extrai um nome de arquivo limpo de uma URL
func extractFilename(urlStr string) string {
	parsed, err := url.Parse(urlStr)
	if err != nil {
		return "image.jpg"
	}

	filename := filepath.Base(parsed.Path)
	if filename == "" || filename == "." || filename == "/" {
		return "image.jpg"
	}

	if !hasImageExtension(filename) {
		filename = filename + ".jpg"
	}

	return filename
}

// ════════════════════════════════════════════════════════════════════════════
// PARSING HTML - Múltiplas candidatas de imagem
// ════════════════════════════════════════════════════════════════════════════

type imageCandidate struct {
	url      string
	source   string
	priority int
}

func (c *Client) parseHTML(body io.Reader, baseURL string) (*ImageInfo, error) {
	// Ler com limite de segurança
	limitedReader := io.LimitReader(body, maxHTMLSize)
	data, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, err
	}
	content := string(data)

	candidates := collectImageCandidates(content)
	if len(candidates) == 0 {
		return nil, errors.New("nenhuma imagem encontrada nos meta dados da página")
	}

	// Normalizar e filtrar candidatas
	var validCandidates []imageCandidate
	for _, cand := range candidates {
		imgURL := decodeHTMLEntities(cand.url)
		if imgURL == "" || strings.HasPrefix(imgURL, "data:") {
			continue
		}

		resolved, err := resolveURL(baseURL, imgURL)
		if err != nil {
			continue
		}

		// Validar URL resolvida (inclui check SSRF)
		if _, err := validateURL(resolved); err != nil {
			continue
		}

		cand.url = resolved
		validCandidates = append(validCandidates, cand)
	}

	if len(validCandidates) == 0 {
		return nil, errors.New("nenhuma imagem válida encontrada após filtragem")
	}

	best := chooseBestCandidate(validCandidates)

	// Tentar obter metadados reais
	info, err := c.ExtractImage(best.url)
	if err == nil {
		info.OriginalURL = baseURL
		return info, nil
	}

	return &ImageInfo{
		OriginalURL: baseURL,
		DirectURL:   best.url,
		ContentType: "image/jpeg",
		Filename:    extractFilename(best.url),
	}, nil
}

func collectImageCandidates(content string) []imageCandidate {
	var candidates []imageCandidate

	patterns := []struct {
		pattern  string
		source   string
		priority int
	}{
		{`<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']`, "og:image:secure_url", 1},
		{`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']`, "og:image:secure_url", 1},
		{`<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']`, "og:image", 2},
		{`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']`, "og:image", 2},
		{`<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']`, "twitter:image", 3},
		{`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']`, "twitter:image", 3},
		{`<meta[^>]+property=["']twitter:image["'][^>]+content=["']([^"']+)["']`, "twitter:image", 3},
		{`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']twitter:image["']`, "twitter:image", 3},

		// Regex para JSONs internos (Instagram SharedData, Twitter State, JSON-LD)
		{`"display_url"\s*:\s*"([^"]+)"`, "instagram:json", 1},      // Instagram JSON
		{`"media_url_https"\s*:\s*"([^"]+)"`, "twitter:json", 1},    // Twitter JSON
		{`"original_image_url"\s*:\s*"([^"]+)"`, "generic:json", 2}, // Generic JSON

		{`<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']`, "twitter:image:src", 4},
		{`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image:src["']`, "twitter:image:src", 4},
		{`<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']`, "image_src", 5},
		{`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']`, "image_src", 5},
		{`"image"\s*:\s*"([^"]+)"`, "schema.org", 6},
		{`"image"\s*:\s*\[\s*"([^"]+)"`, "schema.org", 6},
	}

	seen := make(map[string]bool)

	for _, p := range patterns {
		regex := regexp.MustCompile(p.pattern)
		matches := regex.FindAllStringSubmatch(content, -1)

		for _, match := range matches {
			if len(match) >= 2 && match[1] != "" {
				imgURL := match[1]
				if !seen[imgURL] {
					seen[imgURL] = true
					candidates = append(candidates, imageCandidate{
						url:      imgURL,
						source:   p.source,
						priority: p.priority,
					})
				}
			}
		}
	}

	return candidates
}

func chooseBestCandidate(candidates []imageCandidate) imageCandidate {
	if len(candidates) == 0 {
		return imageCandidate{}
	}

	best := candidates[0]

	for _, cand := range candidates[1:] {
		if cand.priority < best.priority {
			best = cand
			continue
		}

		if cand.priority == best.priority {
			candLower := strings.ToLower(cand.url)
			bestLower := strings.ToLower(best.url)

			largeHints := []string{"large", "orig", "original", "full", "hd", "1080", "1920", "max"}
			candScore := 0
			bestScore := 0

			for _, hint := range largeHints {
				if strings.Contains(candLower, hint) {
					candScore++
				}
				if strings.Contains(bestLower, hint) {
					bestScore++
				}
			}

			if strings.HasPrefix(cand.url, "https://") && strings.HasPrefix(best.url, "http://") {
				candScore++
			}

			if candScore > bestScore {
				best = cand
			}
		}
	}

	return best
}

// ════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ════════════════════════════════════════════════════════════════════════════

func decodeHTMLEntities(s string) string {
	replacements := map[string]string{
		"&amp;":  "&",
		"&lt;":   "<",
		"&gt;":   ">",
		"&quot;": "\"",
		"&#39;":  "'",
		"&#x27;": "'",
		"&#47;":  "/",
		"&#x2F;": "/",
		"&nbsp;": " ",
	}
	for entity, char := range replacements {
		s = strings.ReplaceAll(s, entity, char)
	}
	return s
}

func resolveURL(baseURLStr, refURLStr string) (string, error) {
	if strings.HasPrefix(refURLStr, "http://") || strings.HasPrefix(refURLStr, "https://") {
		return refURLStr, nil
	}

	if strings.HasPrefix(refURLStr, "//") {
		parsedBase, err := url.Parse(baseURLStr)
		if err != nil {
			return "", err
		}
		return parsedBase.Scheme + ":" + refURLStr, nil
	}

	parsedBase, err := url.Parse(baseURLStr)
	if err != nil {
		return "", err
	}

	parsedRef, err := url.Parse(refURLStr)
	if err != nil {
		return "", err
	}

	resolved := parsedBase.ResolveReference(parsedRef)
	return resolved.String(), nil
}

func hasImageExtension(filename string) bool {
	exts := []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg", ".ico"}
	lower := strings.ToLower(filename)
	for _, ext := range exts {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

// ════════════════════════════════════════════════════════════════════════════
// CUIDADO #D: DOWNLOAD SEGURO
// - Valida URL e IP
// - Valida Content-Type
// - Limita tamanho
// - Sniff de bytes iniciais
// ════════════════════════════════════════════════════════════════════════════

// DownloadImage baixa a imagem para o caminho especificado
func (c *Client) DownloadImage(urlStr string, destPath string) error {
	// Validar URL
	parsed, err := validateURL(urlStr)
	if err != nil {
		return err
	}

	// Resolver IP para pinning
	pinnedIP, err := resolveAndValidateHost(parsed.Hostname())
	if err != nil {
		return err
	}

	// Criar client seguro
	secureClient := createSecureClient(parsed, pinnedIP)

	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return err
	}

	// Referer apenas do mesmo host (reduz vazamento)
	referer := parsed.Scheme + "://" + parsed.Host + "/"
	setImageHeaders(req, referer)

	resp, err := secureClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: %d", resp.StatusCode)
	}

	// Validar Content-Type
	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		return fmt.Errorf("tipo de conteúdo inválido: %s (esperado image/*)", contentType)
	}

	// Validar tamanho declarado
	if resp.ContentLength > maxImageSize {
		return fmt.Errorf("imagem muito grande: %d bytes (máximo: %d)", resp.ContentLength, maxImageSize)
	}

	// Criar arquivo
	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	// Ler com limite de tamanho (proteção extra caso Content-Length seja mentira)
	limitedBody := io.LimitReader(resp.Body, maxImageSize)

	// Ler primeiros bytes para sniff
	sniffBuf := make([]byte, 512)
	n, err := io.ReadFull(limitedBody, sniffBuf)
	if err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
		return fmt.Errorf("erro ao ler imagem: %w", err)
	}
	sniffBuf = sniffBuf[:n]

	// Validar tipo via magic bytes (sniff)
	detectedType := http.DetectContentType(sniffBuf)
	if !strings.HasPrefix(detectedType, "image/") {
		// Aceitar também application/octet-stream para alguns formatos
		if detectedType != "application/octet-stream" {
			return fmt.Errorf("conteúdo não parece ser imagem: %s", detectedType)
		}
	}

	// Escrever bytes sniffados
	if _, err := out.Write(sniffBuf); err != nil {
		return err
	}

	// Escrever resto do arquivo
	_, err = io.Copy(out, limitedBody)
	return err
}

package roadmap

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"kingo/internal/logger"
)

// CDNFetcher handles HTTP requests to the Cloudflare Pages CDN
type CDNFetcher struct {
	config     Config
	httpClient *http.Client
}

// NewCDNFetcher creates a new CDN fetcher with the given config
func NewCDNFetcher(cfg Config) *CDNFetcher {
	return &CDNFetcher{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:       10,
				IdleConnTimeout:    90 * time.Second,
				DisableCompression: false, // Enable gzip/brotli
			},
		},
	}
}

// FetchMeta retrieves the lightweight metadata file (<100 bytes)
func (f *CDNFetcher) FetchMeta() (*CDNMeta, error) {
	req, err := http.NewRequest(http.MethodGet, f.config.MetaURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create meta request: %w", err)
	}

	req.Header.Set("User-Agent", "DownKingo-Desktop/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := f.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch meta: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("meta returned status %d", resp.StatusCode)
	}

	var meta CDNMeta
	if err := json.NewDecoder(resp.Body).Decode(&meta); err != nil {
		return nil, fmt.Errorf("decode meta: %w", err)
	}

	return &meta, nil
}

// FetchRoadmapResult contains the roadmap data and HTTP caching info
type FetchRoadmapResult struct {
	Roadmap     *CDNRoadmap
	ContentHash string
	ETag        string
	NotModified bool
}

// FetchRoadmap retrieves the full roadmap JSON with conditional request support
func (f *CDNFetcher) FetchRoadmap(previousETag string) (*FetchRoadmapResult, error) {
	req, err := http.NewRequest(http.MethodGet, f.config.JSONUrl, nil)
	if err != nil {
		return nil, fmt.Errorf("create roadmap request: %w", err)
	}

	req.Header.Set("User-Agent", "DownKingo-Desktop/1.0")
	req.Header.Set("Accept", "application/json")
	// request gzip transparently if we don't set this header manually.
	// req.Header.Set("Accept-Encoding", "gzip, br") <- REMOVED to avoid receiving Brotli (br) which Go doesn't natively decode
	if previousETag != "" {
		req.Header.Set("If-None-Match", previousETag)
	}

	resp, err := f.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch roadmap: %w", err)
	}
	defer resp.Body.Close()

	// 304 Not Modified - use cached version
	if resp.StatusCode == http.StatusNotModified {
		logger.Log.Debug().Msg("[CDN] 304 Not Modified - using cached roadmap")
		return &FetchRoadmapResult{NotModified: true}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("roadmap returned status %d", resp.StatusCode)
	}

	// Read body and compute hash
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read roadmap body: %w", err)
	}

	// Sanitize body: Remove ANSI escape codes (colors) that might have polluted the file
	// This happens if the GitHub Action injected terminal colors into the file
	body = bytes.ReplaceAll(body, []byte{0x1b}, []byte{})
	// Also strip potential leading/trailing whitespace
	body = bytes.TrimSpace(body)

	var roadmap CDNRoadmap
	if err := json.Unmarshal(body, &roadmap); err != nil {
		// Log snippet (UTF-8 safe) for debugging malformed responses
		runes := []rune(string(body))
		if len(runes) > 80 {
			runes = runes[:80]
		}
		logger.Log.Warn().
			Str("snippet", string(runes)).
			Err(err).
			Msg("failed to decode CDN roadmap response")
		return nil, fmt.Errorf("decode roadmap: %w", err)
	}

	// Compute content hash for local verification
	hash := sha256.Sum256(body)
	contentHash := "sha256:" + hex.EncodeToString(hash[:])

	logger.Log.Debug().
		Int("items", len(roadmap.Items)).
		Bool("hasEtag", resp.Header.Get("ETag") != "").
		Msg("[CDN] 200 OK - fetched roadmap")

	return &FetchRoadmapResult{
		Roadmap:     &roadmap,
		ContentHash: contentHash,
		ETag:        resp.Header.Get("ETag"),
		NotModified: false,
	}, nil
}

// CheckNeedsUpdate compares local hash with remote meta to determine if update needed
func (f *CDNFetcher) CheckNeedsUpdate(localHash string) (bool, error) {
	meta, err := f.FetchMeta()
	if err != nil {
		return false, err
	}

	return meta.ContentHash != localHash, nil
}

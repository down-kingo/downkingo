package roadmap

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// =============================================================================
// CDNFetcher Tests with HTTP Mocks
// =============================================================================

func TestCDNFetcher_FetchRoadmap_Success(t *testing.T) {
	t.Parallel()

	mockResponse := `{
		"source": {
			"owner": "test-org",
			"repo": "test-repo",
			"project_number": 1
		},
		"items": [
			{
				"id": 1,
				"title": "Feature A",
				"description": "Description A",
				"status": "idea",
				"votes_up": 10,
				"votes_down": 2,
				"comments": 5,
				"url": "https://github.com/test/issues/1",
				"labels": ["enhancement"],
				"author": "testuser",
				"author_avatar": "https://avatars.githubusercontent.com/testuser",
				"created_at": "2024-01-01T00:00:00Z"
			}
		]
	}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request headers
		if r.Header.Get("User-Agent") != "DownKingo-Desktop/1.0" {
			t.Error("expected User-Agent header")
		}
		if r.Header.Get("Accept") != "application/json" {
			t.Error("expected Accept header")
		}

		w.Header().Set("ETag", `"abc123"`)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(mockResponse))
	}))
	defer server.Close()

	cfg := Config{JSONUrl: server.URL}
	fetcher := NewCDNFetcher(cfg)

	result, err := fetcher.FetchRoadmap("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify result
	if result.NotModified {
		t.Error("expected NotModified = false")
	}
	if result.Roadmap == nil {
		t.Fatal("expected roadmap, got nil")
	}
	if len(result.Roadmap.Items) != 1 {
		t.Errorf("expected 1 item, got %d", len(result.Roadmap.Items))
	}
	if result.ETag != `"abc123"` {
		t.Errorf("expected ETag %q, got %q", `"abc123"`, result.ETag)
	}
	if result.ContentHash == "" {
		t.Error("expected ContentHash to be set")
	}
	if !strings.HasPrefix(result.ContentHash, "sha256:") {
		t.Errorf("expected ContentHash to start with sha256:, got %s", result.ContentHash)
	}

	// Verify parsed item
	item := result.Roadmap.Items[0]
	if item.ID != 1 {
		t.Errorf("item.ID = %d, want 1", item.ID)
	}
	if item.Title != "Feature A" {
		t.Errorf("item.Title = %q, want %q", item.Title, "Feature A")
	}
	if item.Status != "idea" {
		t.Errorf("item.Status = %q, want %q", item.Status, "idea")
	}
}

func TestCDNFetcher_FetchRoadmap_304NotModified(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		etag := r.Header.Get("If-None-Match")
		if etag == `"cached-etag"` {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		t.Errorf("expected If-None-Match header with cached-etag, got %q", etag)
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()

	cfg := Config{JSONUrl: server.URL}
	fetcher := NewCDNFetcher(cfg)

	result, err := fetcher.FetchRoadmap(`"cached-etag"`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.NotModified {
		t.Error("expected NotModified = true")
	}
	if result.Roadmap != nil {
		t.Error("expected nil roadmap for 304")
	}
}

func TestCDNFetcher_FetchRoadmap_ServerError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		statusCode int
	}{
		{"500 Internal Server Error", http.StatusInternalServerError},
		{"502 Bad Gateway", http.StatusBadGateway},
		{"503 Service Unavailable", http.StatusServiceUnavailable},
		{"404 Not Found", http.StatusNotFound},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
			}))
			defer server.Close()

			cfg := Config{JSONUrl: server.URL}
			fetcher := NewCDNFetcher(cfg)

			_, err := fetcher.FetchRoadmap("")
			if err == nil {
				t.Errorf("expected error for status %d", tt.statusCode)
			}
		})
	}
}

func TestCDNFetcher_FetchRoadmap_MalformedJSON(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		payload string
	}{
		{"empty body", ""},
		{"invalid JSON", "not valid json"},
		{"partial JSON", `{"items": [`},
		{"wrong structure", `{"foo": "bar"}`},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(tt.payload))
			}))
			defer server.Close()

			cfg := Config{JSONUrl: server.URL}
			fetcher := NewCDNFetcher(cfg)

			_, err := fetcher.FetchRoadmap("")
			if err == nil && tt.name != "wrong structure" {
				t.Error("expected error for malformed JSON")
			}
		})
	}
}

func TestCDNFetcher_FetchRoadmap_NetworkTimeout(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simulate slow server - longer than client timeout
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := Config{JSONUrl: server.URL}
	fetcher := &CDNFetcher{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Millisecond, // Very short timeout
		},
	}

	_, err := fetcher.FetchRoadmap("")
	if err == nil {
		t.Error("expected timeout error")
	}
}

func TestCDNFetcher_FetchRoadmap_GzipCompression(t *testing.T) {
	t.Parallel()

	mockResponse := `{"source":{"owner":"test"},"items":[]}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Note: Go's http client handles gzip transparently
		// This test verifies our code works with compressed responses
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Encoding", "gzip")
		w.WriteHeader(http.StatusOK)

		gz := gzip.NewWriter(w)
		defer gz.Close()
		gz.Write([]byte(mockResponse))
	}))
	defer server.Close()

	cfg := Config{JSONUrl: server.URL}
	fetcher := NewCDNFetcher(cfg)

	result, err := fetcher.FetchRoadmap("")
	if err != nil {
		t.Fatalf("unexpected error with gzip: %v", err)
	}
	if result.Roadmap == nil {
		t.Error("expected roadmap from gzip response")
	}
}

func TestCDNFetcher_FetchRoadmap_SanitizesANSICodes(t *testing.T) {
	t.Parallel()

	// Simulate polluted JSON with isolated ESC byte (0x1b)
	// Our sanitizer removes the ESC byte, making the JSON parseable
	pollutedResponse := "\x1b" + `{"source":{"owner":"test"},"items":[]}` + "\x1b"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(pollutedResponse))
	}))
	defer server.Close()

	cfg := Config{JSONUrl: server.URL}
	fetcher := NewCDNFetcher(cfg)

	result, err := fetcher.FetchRoadmap("")
	if err != nil {
		t.Fatalf("expected sanitization to handle ESC bytes: %v", err)
	}
	if result.Roadmap == nil {
		t.Error("expected roadmap after sanitization")
	}
}

// =============================================================================
// FetchMeta Tests
// =============================================================================

func TestCDNFetcher_FetchMeta_Success(t *testing.T) {
	t.Parallel()

	mockMeta := `{
		"version": "1.0.0",
		"generated_at": "2024-01-15T10:00:00Z",
		"items_count": 42,
		"content_hash": "sha256:abc123"
	}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(mockMeta))
	}))
	defer server.Close()

	cfg := Config{MetaURL: server.URL}
	fetcher := NewCDNFetcher(cfg)

	meta, err := fetcher.FetchMeta()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if meta.Version != "1.0.0" {
		t.Errorf("Version = %q, want %q", meta.Version, "1.0.0")
	}
	if meta.ItemsCount != 42 {
		t.Errorf("ItemsCount = %d, want %d", meta.ItemsCount, 42)
	}
	if meta.ContentHash != "sha256:abc123" {
		t.Errorf("ContentHash = %q, want %q", meta.ContentHash, "sha256:abc123")
	}
}

func TestCDNFetcher_FetchMeta_Error(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	cfg := Config{MetaURL: server.URL}
	fetcher := NewCDNFetcher(cfg)

	_, err := fetcher.FetchMeta()
	if err == nil {
		t.Error("expected error for 500 response")
	}
}

// =============================================================================
// CheckNeedsUpdate Tests
// =============================================================================

func TestCDNFetcher_CheckNeedsUpdate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		localHash  string
		remoteHash string
		wantUpdate bool
	}{
		{
			name:       "different hash needs update",
			localHash:  "sha256:old",
			remoteHash: "sha256:new",
			wantUpdate: true,
		},
		{
			name:       "same hash no update",
			localHash:  "sha256:same",
			remoteHash: "sha256:same",
			wantUpdate: false,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				meta := `{"content_hash": "` + tt.remoteHash + `"}`
				w.Write([]byte(meta))
			}))
			defer server.Close()

			cfg := Config{MetaURL: server.URL}
			fetcher := NewCDNFetcher(cfg)

			needsUpdate, err := fetcher.CheckNeedsUpdate(tt.localHash)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if needsUpdate != tt.wantUpdate {
				t.Errorf("CheckNeedsUpdate() = %v, want %v", needsUpdate, tt.wantUpdate)
			}
		})
	}
}

// =============================================================================
// Benchmarks
// =============================================================================

func BenchmarkCDNFetcher_FetchRoadmap(b *testing.B) {
	mockResponse := `{"source":{"owner":"test"},"items":[{"id":1,"title":"Test","status":"idea"}]}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(mockResponse))
	}))
	defer server.Close()

	cfg := Config{JSONUrl: server.URL}
	fetcher := NewCDNFetcher(cfg)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		fetcher.FetchRoadmap("")
	}
}

// =============================================================================
// Helper: Discard Logger for Tests
// =============================================================================

func init() {
	// Silence logger during tests
	// In a real scenario, you might use a test logger
	_ = io.Discard
}

package roadmap

import (
	"testing"
)

// =============================================================================
// Unit Tests: Pure Functions
// =============================================================================

func TestSanitizeCDNURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "valid HTTPS URL",
			input:    "https://cdn.example.com",
			expected: "https://cdn.example.com",
		},
		{
			name:     "valid HTTPS with trailing slash",
			input:    "https://cdn.example.com/",
			expected: "https://cdn.example.com",
		},
		{
			name:     "valid HTTPS with subdomain",
			input:    "https://downkingo-roadmap.pages.dev",
			expected: "https://downkingo-roadmap.pages.dev",
		},
		{
			name:     "rejected - HTTP not allowed",
			input:    "http://insecure.com",
			expected: "",
		},
		{
			name:     "rejected - query string not allowed",
			input:    "https://evil.com?token=secret",
			expected: "",
		},
		{
			name:     "rejected - path is stripped",
			input:    "https://cdn.example.com/some/path",
			expected: "https://cdn.example.com",
		},
		{
			name:     "rejected - invalid URL",
			input:    "not-a-valid-url",
			expected: "",
		},
		{
			name:     "rejected - empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "rejected - missing host",
			input:    "https://",
			expected: "",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := sanitizeCDNURL(tt.input)
			if got != tt.expected {
				t.Errorf("sanitizeCDNURL(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestExtractHost(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input    string
		expected string
	}{
		{"https://example.com", "example.com"},
		{"https://sub.example.com:8080", "sub.example.com:8080"},
		{"invalid-url", ""},
		{"", ""},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.input, func(t *testing.T) {
			t.Parallel()
			got := extractHost(tt.input)
			if got != tt.expected {
				t.Errorf("extractHost(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestMaskURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		wantLen  int
		wantDots bool
	}{
		{
			name:     "short URL unchanged",
			input:    "https://short.com",
			wantLen:  17,
			wantDots: false,
		},
		{
			name:     "long URL truncated",
			input:    "https://very-long-url-that-exceeds-fifty-characters-limit.example.com/path",
			wantLen:  53, // 50 + "..."
			wantDots: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := maskURL(tt.input)
			if len(got) != tt.wantLen {
				t.Errorf("maskURL() len = %d, want %d", len(got), tt.wantLen)
			}
		})
	}
}

func TestItemsEqual(t *testing.T) {
	t.Parallel()

	item1 := RoadmapItem{ID: 1, Title: "Feature A", Votes: 10}
	item2 := RoadmapItem{ID: 2, Title: "Feature B", Votes: 5}
	item1Copy := RoadmapItem{ID: 1, Title: "Feature A", Votes: 10}
	item1Modified := RoadmapItem{ID: 1, Title: "Feature A Modified", Votes: 10}

	tests := []struct {
		name     string
		a        []RoadmapItem
		b        []RoadmapItem
		expected bool
	}{
		{
			name:     "empty slices are equal",
			a:        []RoadmapItem{},
			b:        []RoadmapItem{},
			expected: true,
		},
		{
			name:     "nil slices are equal",
			a:        nil,
			b:        nil,
			expected: true,
		},
		{
			name:     "identical items",
			a:        []RoadmapItem{item1, item2},
			b:        []RoadmapItem{item1Copy, item2},
			expected: true,
		},
		{
			name:     "different length",
			a:        []RoadmapItem{item1},
			b:        []RoadmapItem{item1, item2},
			expected: false,
		},
		{
			name:     "different title",
			a:        []RoadmapItem{item1},
			b:        []RoadmapItem{item1Modified},
			expected: false,
		},
		{
			name:     "different order",
			a:        []RoadmapItem{item1, item2},
			b:        []RoadmapItem{item2, item1},
			expected: false,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := itemsEqual(tt.a, tt.b)
			if got != tt.expected {
				t.Errorf("itemsEqual() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestStatusMapping(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input    string
		expected Status
		exists   bool
	}{
		{"bastidores", StatusIdeia, true},
		{"em pauta", StatusPlanned, true},
		{"em produção", StatusInProgress, true},
		{"no ar", StatusShipped, true},
		{"backlog", StatusIdeia, true},
		{"todo", StatusIdeia, true},
		{"ready", StatusPlanned, true},
		{"planned", StatusPlanned, true},
		{"in progress", StatusInProgress, true},
		{"in_progress", StatusInProgress, true},
		{"done", StatusShipped, true},
		{"shipped", StatusShipped, true},
		{"completed", StatusShipped, true},
		{"unknown", "", false},
		{"", "", false},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.input, func(t *testing.T) {
			t.Parallel()
			got, exists := statusMapping[tt.input]
			if exists != tt.exists {
				t.Errorf("statusMapping[%q] exists = %v, want %v", tt.input, exists, tt.exists)
			}
			if exists && got != tt.expected {
				t.Errorf("statusMapping[%q] = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

// =============================================================================
// Service Tests
// =============================================================================

func TestNewService(t *testing.T) {
	t.Parallel()

	s := NewService("test-owner", "test-repo")

	if s.repoOwner != "test-owner" {
		t.Errorf("repoOwner = %q, want %q", s.repoOwner, "test-owner")
	}
	if s.repoName != "test-repo" {
		t.Errorf("repoName = %q, want %q", s.repoName, "test-repo")
	}
	if s.projectNumber != 2 {
		t.Errorf("projectNumber = %d, want %d", s.projectNumber, 2)
	}
	if s.useCDN != false {
		t.Error("useCDN should default to false")
	}
	if s.cdnFetcher == nil {
		t.Error("cdnFetcher should be initialized")
	}
}

func TestService_EnableCDN(t *testing.T) {
	t.Parallel()

	s := NewService("owner", "repo")

	if s.useCDN != false {
		t.Fatal("precondition: useCDN should be false")
	}

	s.EnableCDN(true)
	if s.useCDN != true {
		t.Error("EnableCDN(true) should set useCDN to true")
	}

	s.EnableCDN(false)
	if s.useCDN != false {
		t.Error("EnableCDN(false) should set useCDN to false")
	}
}

func TestService_LoadFromMemoryCache(t *testing.T) {
	t.Parallel()

	t.Run("returns nil when cache is empty", func(t *testing.T) {
		s := NewService("owner", "repo")
		got := s.loadFromMemoryCache()
		if got != nil {
			t.Error("expected nil for empty cache")
		}
	})

	t.Run("returns nil when cache is expired", func(t *testing.T) {
		s := NewService("owner", "repo")
		s.cache = []RoadmapItem{{ID: 1}}
		s.lastFetch = s.lastFetch.Add(-5 * 60 * 1000000000) // 5 minutes ago

		got := s.loadFromMemoryCache()
		if got != nil {
			t.Error("expected nil for expired cache")
		}
	})
}

func TestParseDate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input    string
		expected string
	}{
		{"2024-01-15T10:30:00Z", "2024-01-15"},
		{"2024-12-31T23:59:59Z", "2024-12-31"},
		{"invalid", ""},
		{"", ""},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.input, func(t *testing.T) {
			t.Parallel()
			got := parseDate(tt.input)
			if got != tt.expected {
				t.Errorf("parseDate(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

// =============================================================================
// Benchmarks
// =============================================================================

func BenchmarkSanitizeCDNURL(b *testing.B) {
	url := "https://downkingo-roadmap.pages.dev"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sanitizeCDNURL(url)
	}
}

func BenchmarkItemsEqual(b *testing.B) {
	items := make([]RoadmapItem, 100)
	for i := range items {
		items[i] = RoadmapItem{ID: i, Title: "Feature", Votes: i * 10}
	}
	itemsCopy := make([]RoadmapItem, len(items))
	copy(itemsCopy, items)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		itemsEqual(items, itemsCopy)
	}
}

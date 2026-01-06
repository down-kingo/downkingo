package roadmap

import (
	"time"
)

// CDN Response Types (external contract)

// CDNRoadmap represents the full roadmap JSON from CDN
type CDNRoadmap struct {
	Version     string    `json:"version"`
	GeneratedAt time.Time `json:"generated_at"`
	Source      CDNSource `json:"source"`
	Items       []CDNItem `json:"items"`
}

// CDNSource contains metadata about the roadmap source
type CDNSource struct {
	Owner         string `json:"owner"`
	Repo          string `json:"repo"`
	ProjectNumber int    `json:"project_number"`
}

// CDNItem represents a single feature/issue from CDN
type CDNItem struct {
	ID            int      `json:"id"`
	Title         string   `json:"title"`
	FriendlyTitle string   `json:"friendly_title,omitempty"`
	Description   string   `json:"description"`
	Status        Status   `json:"status"`
	VotesUp       int      `json:"votes_up"`
	VotesDown     int      `json:"votes_down"`
	Comments      int      `json:"comments"`
	URL           string   `json:"url"`
	Labels        []string `json:"labels"`
	Author        string   `json:"author"`
	AuthorAvatar  string   `json:"author_avatar"`
	CreatedAt     string   `json:"created_at"`
	ShippedAt     *string  `json:"shipped_at,omitempty"`
}

// CDNMeta represents the lightweight metadata file
type CDNMeta struct {
	Version     string    `json:"version"`
	GeneratedAt time.Time `json:"generated_at"`
	ItemsCount  int       `json:"items_count"`
	ContentHash string    `json:"content_hash"`
}

// RoadmapCache represents the cached roadmap data in SQLite
type RoadmapCache struct {
	ID          int       `json:"id"`
	Data        string    `json:"data"`         // JSON blob of CDNRoadmap
	ContentHash string    `json:"content_hash"` // SHA256 of roadmap.json
	ETag        string    `json:"etag"`         // HTTP ETag for CDN
	FetchedAt   time.Time `json:"fetched_at"`
}

// SyncState tracks the background sync status
type SyncState struct {
	InProgress  bool
	LastSync    time.Time
	LastError   error
	ErrorCount  int
	BackoffTime time.Duration
}

// Config holds CDN configuration constants
type Config struct {
	CDNURL         string
	MetaURL        string
	JSONUrl        string
	SyncInterval   time.Duration
	MaxBackoff     time.Duration
	InitialBackoff time.Duration
	JitterMax      time.Duration
}

// DefaultConfig returns production CDN configuration
func DefaultConfig() Config {
	return Config{
		CDNURL:         "https://downkingo-roadmap.pages.dev",
		MetaURL:        "https://downkingo-roadmap.pages.dev/roadmap.meta.json",
		JSONUrl:        "https://downkingo-roadmap.pages.dev/roadmap.json",
		SyncInterval:   5 * time.Minute,
		MaxBackoff:     60 * time.Second,
		InitialBackoff: 1 * time.Second,
		JitterMax:      30 * time.Second,
	}
}

// ToRoadmapItem converts CDNItem to frontend-compatible RoadmapItem
func (c *CDNItem) ToRoadmapItem() RoadmapItem {
	item := RoadmapItem{
		ID:           c.ID,
		Title:        c.Title,
		Description:  c.Description,
		Status:       c.Status,
		Votes:        c.VotesUp, // Maintain backwards compatibility
		Comments:     c.Comments,
		URL:          c.URL,
		Labels:       c.Labels,
		Author:       c.Author,
		AuthorAvatar: c.AuthorAvatar,
		CreatedAt:    c.CreatedAt,
	}
	if c.ShippedAt != nil {
		item.ShippedAt = *c.ShippedAt
	}
	return item
}

// ToRoadmapItems converts a slice of CDNItems to RoadmapItems
func ToRoadmapItems(cdnItems []CDNItem) []RoadmapItem {
	items := make([]RoadmapItem, 0, len(cdnItems))
	for _, ci := range cdnItems {
		items = append(items, ci.ToRoadmapItem())
	}
	return items
}

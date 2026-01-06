package roadmap

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// CacheRepository handles SQLite persistence for roadmap data
type CacheRepository struct {
	db *sql.DB
}

// NewCacheRepository creates a cache repository with the given database
func NewCacheRepository(db *sql.DB) *CacheRepository {
	return &CacheRepository{db: db}
}

// Migrate creates the roadmap_cache table if it doesn't exist
func (r *CacheRepository) Migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS roadmap_cache (
		id INTEGER PRIMARY KEY DEFAULT 1,
		data TEXT NOT NULL,
		content_hash TEXT,
		etag TEXT,
		fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := r.db.Exec(schema)
	return err
}

// Load retrieves the cached roadmap from SQLite
func (r *CacheRepository) Load() (*RoadmapCache, error) {
	if r.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	var cache RoadmapCache
	var fetchedAtStr string

	err := r.db.QueryRow(`
		SELECT id, data, COALESCE(content_hash, ''), COALESCE(etag, ''), fetched_at 
		FROM roadmap_cache 
		WHERE id = 1
	`).Scan(&cache.ID, &cache.Data, &cache.ContentHash, &cache.ETag, &fetchedAtStr)

	if err == sql.ErrNoRows {
		return nil, nil // No cache exists
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load cache: %w", err)
	}

	// Parse fetched_at timestamp
	cache.FetchedAt, _ = time.Parse("2006-01-02 15:04:05", fetchedAtStr)

	return &cache, nil
}

// Save stores the roadmap data in SQLite cache
func (r *CacheRepository) Save(data *CDNRoadmap, contentHash, etag string) error {
	if r.db == nil {
		return fmt.Errorf("database not initialized")
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal roadmap: %w", err)
	}

	// Upsert: INSERT OR REPLACE
	_, err = r.db.Exec(`
		INSERT OR REPLACE INTO roadmap_cache (id, data, content_hash, etag, fetched_at)
		VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
	`, string(jsonData), contentHash, etag)

	if err != nil {
		return fmt.Errorf("failed to save cache: %w", err)
	}

	return nil
}

// GetContentHash returns only the stored content hash for quick comparison
func (r *CacheRepository) GetContentHash() (string, error) {
	if r.db == nil {
		return "", nil
	}

	var hash string
	err := r.db.QueryRow(`SELECT COALESCE(content_hash, '') FROM roadmap_cache WHERE id = 1`).Scan(&hash)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return hash, err
}

// GetETag returns the stored ETag for HTTP conditional requests
func (r *CacheRepository) GetETag() (string, error) {
	if r.db == nil {
		return "", nil
	}

	var etag string
	err := r.db.QueryRow(`SELECT COALESCE(etag, '') FROM roadmap_cache WHERE id = 1`).Scan(&etag)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return etag, err
}

// ParseCachedData deserializes the cached JSON into CDNRoadmap
func (r *CacheRepository) ParseCachedData(cache *RoadmapCache) (*CDNRoadmap, error) {
	if cache == nil || cache.Data == "" {
		return nil, nil
	}

	var roadmap CDNRoadmap
	if err := json.Unmarshal([]byte(cache.Data), &roadmap); err != nil {
		return nil, fmt.Errorf("failed to parse cached data: %w", err)
	}

	return &roadmap, nil
}

// Clear removes all cached roadmap data
func (r *CacheRepository) Clear() error {
	if r.db == nil {
		return nil
	}

	_, err := r.db.Exec(`DELETE FROM roadmap_cache`)
	return err
}

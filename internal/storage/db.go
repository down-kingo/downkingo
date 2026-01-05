package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// DB wraps the SQLite database connection
type DB struct {
	conn *sql.DB
	path string
}

// New creates and initializes a new database connection
func New(dataDir string) (*DB, error) {
	// Ensure directory exists
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	dbPath := filepath.Join(dataDir, "downkingo.db")

	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable foreign keys and WAL mode for better performance
	pragmas := []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA cache_size = -64000", // 64MB cache
	}

	for _, pragma := range pragmas {
		if _, err := conn.Exec(pragma); err != nil {
			conn.Close()
			return nil, fmt.Errorf("failed to set pragma: %w", err)
		}
	}

	db := &DB{conn: conn, path: dbPath}

	// Run migrations
	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.conn.Close()
}

// migrate runs database migrations
func (db *DB) migrate() error {
	schema := `
	-- Downloads queue and history
	CREATE TABLE IF NOT EXISTS downloads (
		id TEXT PRIMARY KEY,
		url TEXT NOT NULL,
		title TEXT,
		thumbnail TEXT,
		duration INTEGER DEFAULT 0,
		uploader TEXT,
		format TEXT DEFAULT 'best',
		audio_only BOOLEAN DEFAULT FALSE,
		status TEXT DEFAULT 'pending', -- pending, downloading, merging, completed, failed, cancelled
		progress REAL DEFAULT 0,
		speed TEXT,
		eta TEXT,
		file_path TEXT,
		file_size INTEGER DEFAULT 0,
		error_message TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		started_at DATETIME,
		completed_at DATETIME
	);

	-- Index for common queries
	CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
	CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at DESC);

	-- Subscriptions (for future Fase 4)
	CREATE TABLE IF NOT EXISTS subscriptions (
		id TEXT PRIMARY KEY,
		channel_id TEXT NOT NULL UNIQUE,
		channel_name TEXT,
		channel_url TEXT NOT NULL,
		last_checked DATETIME,
		last_video_id TEXT,
		enabled BOOLEAN DEFAULT TRUE,
		check_interval INTEGER DEFAULT 3600, -- seconds
		auto_download BOOLEAN DEFAULT FALSE,
		format TEXT DEFAULT 'best',
		audio_only BOOLEAN DEFAULT FALSE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- Settings (key-value store for preferences)
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT
	);

	-- Roadmap cache (CDN data persistence)
	CREATE TABLE IF NOT EXISTS roadmap_cache (
		id INTEGER PRIMARY KEY DEFAULT 1,
		data TEXT NOT NULL,
		content_hash TEXT,
		etag TEXT,
		fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`

	_, err := db.conn.Exec(schema)
	return err
}

// Conn returns the underlying database connection for advanced queries
func (db *DB) Conn() *sql.DB {
	return db.conn
}

// DownloadStatus represents the state of a download
type DownloadStatus string

const (
	StatusPending     DownloadStatus = "pending"
	StatusDownloading DownloadStatus = "downloading"
	StatusMerging     DownloadStatus = "merging"
	StatusCompleted   DownloadStatus = "completed"
	StatusFailed      DownloadStatus = "failed"
	StatusCancelled   DownloadStatus = "cancelled"
)

// Download represents a download record in the database
type Download struct {
	ID           string         `json:"id"`
	URL          string         `json:"url"`
	Title        string         `json:"title"`
	Thumbnail    string         `json:"thumbnail"`
	Duration     int            `json:"duration"`
	Uploader     string         `json:"uploader"`
	Format       string         `json:"format"`
	AudioOnly    bool           `json:"audioOnly"`
	Status       DownloadStatus `json:"status"`
	Progress     float64        `json:"progress"`
	Speed        string         `json:"speed"`
	ETA          string         `json:"eta"`
	FilePath     string         `json:"filePath"`
	FileSize     int64          `json:"fileSize"`
	ErrorMessage string         `json:"errorMessage"`
	CreatedAt    time.Time      `json:"createdAt"`
	StartedAt    *time.Time     `json:"startedAt"`
	CompletedAt  *time.Time     `json:"completedAt"`
}

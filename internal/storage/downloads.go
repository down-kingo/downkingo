package storage

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// downloadColumns is the standard SELECT column list using COALESCE to avoid sql.NullString overhead.
// This eliminates ~8 NullString allocations per row scanned.
const downloadColumns = `id, url, COALESCE(title,''), COALESCE(thumbnail,''), duration, COALESCE(uploader,''),
	COALESCE(format,'best'), audio_only, status, progress, COALESCE(speed,''), COALESCE(eta,''),
	COALESCE(file_path,''), file_size, COALESCE(error_message,''),
	created_at, started_at, completed_at`

// DownloadRepository handles download CRUD operations
type DownloadRepository struct {
	db *DB
}

// NewDownloadRepository creates a new download repository
func NewDownloadRepository(db *DB) *DownloadRepository {
	return &DownloadRepository{db: db}
}

// Create inserts a new download record
func (r *DownloadRepository) Create(d *Download) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	d.CreatedAt = time.Now()

	query := `
		INSERT INTO downloads (id, url, title, thumbnail, duration, uploader, format, audio_only, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := r.db.conn.Exec(query,
		d.ID, d.URL, d.Title, d.Thumbnail, d.Duration, d.Uploader,
		d.Format, d.AudioOnly, d.Status, d.CreatedAt,
	)

	return err
}

// Update updates an existing download record
func (r *DownloadRepository) Update(d *Download) error {
	query := `
		UPDATE downloads SET
			title = ?, thumbnail = ?, duration = ?, uploader = ?,
			status = ?, progress = ?, speed = ?, eta = ?,
			file_path = ?, file_size = ?, error_message = ?,
			started_at = ?, completed_at = ?
		WHERE id = ?
	`

	_, err := r.db.conn.Exec(query,
		d.Title, d.Thumbnail, d.Duration, d.Uploader,
		d.Status, d.Progress, d.Speed, d.ETA,
		d.FilePath, d.FileSize, d.ErrorMessage,
		d.StartedAt, d.CompletedAt, d.ID,
	)

	return err
}

// ExistsActiveByURL checks if there's already an active download for this URL
// Returns the existing download if found, nil otherwise
func (r *DownloadRepository) ExistsActiveByURL(url string) (*Download, error) {
	query := `SELECT ` + downloadColumns + ` FROM downloads
		WHERE url = ? AND status NOT IN ('completed', 'failed', 'cancelled')
		LIMIT 1`
	d := &Download{}
	err := r.db.conn.QueryRow(query, url).Scan(
		&d.ID, &d.URL, &d.Title, &d.Thumbnail, &d.Duration, &d.Uploader,
		&d.Format, &d.AudioOnly, &d.Status, &d.Progress, &d.Speed, &d.ETA,
		&d.FilePath, &d.FileSize, &d.ErrorMessage,
		&d.CreatedAt, &d.StartedAt, &d.CompletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return d, nil
}

// UpdateStatus updates only the status of a download
func (r *DownloadRepository) UpdateStatus(id string, status DownloadStatus) error {
	query := `UPDATE downloads SET status = ? WHERE id = ?`
	_, err := r.db.conn.Exec(query, status, id)
	return err
}

// UpdateProgress updates progress fields
func (r *DownloadRepository) UpdateProgress(id string, progress float64, speed, eta string) error {
	query := `UPDATE downloads SET progress = ?, speed = ?, eta = ? WHERE id = ?`
	_, err := r.db.conn.Exec(query, progress, speed, eta, id)
	return err
}

// GetByID retrieves a download by ID
func (r *DownloadRepository) GetByID(id string) (*Download, error) {
	query := `SELECT ` + downloadColumns + ` FROM downloads WHERE id = ?`

	d := &Download{}
	err := r.db.conn.QueryRow(query, id).Scan(
		&d.ID, &d.URL, &d.Title, &d.Thumbnail, &d.Duration, &d.Uploader,
		&d.Format, &d.AudioOnly, &d.Status, &d.Progress, &d.Speed, &d.ETA,
		&d.FilePath, &d.FileSize, &d.ErrorMessage,
		&d.CreatedAt, &d.StartedAt, &d.CompletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return d, nil
}

// GetPending retrieves all pending downloads ordered by creation time
func (r *DownloadRepository) GetPending() ([]*Download, error) {
	return r.getByStatus(StatusPending)
}

// GetActive retrieves downloads that are currently downloading or merging
func (r *DownloadRepository) GetActive() ([]*Download, error) {
	query := `SELECT ` + downloadColumns + ` FROM downloads
		WHERE status IN ('downloading', 'merging') ORDER BY started_at ASC`
	return r.queryDownloads(query)
}

// GetHistory retrieves completed and failed downloads
func (r *DownloadRepository) GetHistory(limit int) ([]*Download, error) {
	query := `SELECT ` + downloadColumns + ` FROM downloads
		WHERE status IN ('completed', 'failed', 'cancelled') ORDER BY completed_at DESC LIMIT ?`
	return r.queryDownloadsWithArgs(query, limit)
}

// GetQueue retrieves all non-completed downloads (pending + active)
func (r *DownloadRepository) GetQueue() ([]*Download, error) {
	query := `SELECT ` + downloadColumns + ` FROM downloads
		WHERE status NOT IN ('completed', 'failed', 'cancelled') ORDER BY created_at ASC`
	return r.queryDownloads(query)
}

// Delete removes a download record
func (r *DownloadRepository) Delete(id string) error {
	_, err := r.db.conn.Exec("DELETE FROM downloads WHERE id = ?", id)
	return err
}

// ClearHistory removes all completed/failed downloads
func (r *DownloadRepository) ClearHistory() error {
	_, err := r.db.conn.Exec("DELETE FROM downloads WHERE status IN ('completed', 'failed', 'cancelled')")
	return err
}

// getByStatus retrieves downloads with a specific status
func (r *DownloadRepository) getByStatus(status DownloadStatus) ([]*Download, error) {
	query := `SELECT ` + downloadColumns + ` FROM downloads WHERE status = ? ORDER BY created_at ASC`
	return r.queryDownloadsWithArgs(query, status)
}

// queryDownloads executes a query and returns downloads
func (r *DownloadRepository) queryDownloads(query string) ([]*Download, error) {
	rows, err := r.db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanDownloads(rows)
}

// queryDownloadsWithArgs executes a query with args and returns downloads
func (r *DownloadRepository) queryDownloadsWithArgs(query string, args ...interface{}) ([]*Download, error) {
	rows, err := r.db.conn.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanDownloads(rows)
}

// scanDownloads scans rows into Download structs.
// Uses COALESCE in queries to avoid sql.NullString allocations (~8 per row).
func (r *DownloadRepository) scanDownloads(rows *sql.Rows) ([]*Download, error) {
	var downloads []*Download

	for rows.Next() {
		d := &Download{}
		err := rows.Scan(
			&d.ID, &d.URL, &d.Title, &d.Thumbnail, &d.Duration, &d.Uploader,
			&d.Format, &d.AudioOnly, &d.Status, &d.Progress, &d.Speed, &d.ETA,
			&d.FilePath, &d.FileSize, &d.ErrorMessage,
			&d.CreatedAt, &d.StartedAt, &d.CompletedAt,
		)
		if err != nil {
			return nil, err
		}
		downloads = append(downloads, d)
	}

	return downloads, rows.Err()
}

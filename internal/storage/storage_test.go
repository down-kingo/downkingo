package storage

import (
	"testing"
	"time"
)

// setupTestDB creates an in-memory SQLite database for testing.
// Each test gets an isolated database.
func setupTestDB(t *testing.T) *DB {
	t.Helper()

	db, err := New(t.TempDir())
	if err != nil {
		t.Fatalf("failed to create test database: %v", err)
	}

	t.Cleanup(func() {
		db.Close()
	})

	return db
}

func newTestDownload(url string) *Download {
	return &Download{
		URL:       url,
		Title:     "Test Video",
		Format:    "best",
		AudioOnly: false,
		Status:    StatusPending,
	}
}

// =============================================================================
// Database Initialization Tests
// =============================================================================

func TestNew_CreatesDatabaseAndMigrates(t *testing.T) {
	db := setupTestDB(t)

	// Verify tables exist by querying them
	var count int
	err := db.conn.QueryRow("SELECT COUNT(*) FROM downloads").Scan(&count)
	if err != nil {
		t.Fatalf("downloads table should exist: %v", err)
	}

	err = db.conn.QueryRow("SELECT COUNT(*) FROM subscriptions").Scan(&count)
	if err != nil {
		t.Fatalf("subscriptions table should exist: %v", err)
	}

	err = db.conn.QueryRow("SELECT COUNT(*) FROM settings").Scan(&count)
	if err != nil {
		t.Fatalf("settings table should exist: %v", err)
	}

	err = db.conn.QueryRow("SELECT COUNT(*) FROM roadmap_cache").Scan(&count)
	if err != nil {
		t.Fatalf("roadmap_cache table should exist: %v", err)
	}
}

func TestNew_SetsWALMode(t *testing.T) {
	db := setupTestDB(t)

	var journalMode string
	err := db.conn.QueryRow("PRAGMA journal_mode").Scan(&journalMode)
	if err != nil {
		t.Fatalf("failed to query journal_mode: %v", err)
	}
	if journalMode != "wal" {
		t.Errorf("journal_mode = %q, want %q", journalMode, "wal")
	}
}

// =============================================================================
// DownloadRepository CRUD Tests
// =============================================================================

func TestDownloadRepository_Create(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	t.Run("creates download with generated ID", func(t *testing.T) {
		d := newTestDownload("https://youtube.com/watch?v=abc123")
		err := repo.Create(d)
		if err != nil {
			t.Fatalf("Create() error: %v", err)
		}
		if d.ID == "" {
			t.Error("expected generated ID, got empty")
		}
		if d.CreatedAt.IsZero() {
			t.Error("expected CreatedAt to be set")
		}
	})

	t.Run("creates download with provided ID", func(t *testing.T) {
		d := newTestDownload("https://youtube.com/watch?v=def456")
		d.ID = "custom-id-123"
		err := repo.Create(d)
		if err != nil {
			t.Fatalf("Create() error: %v", err)
		}
		if d.ID != "custom-id-123" {
			t.Errorf("ID = %q, want %q", d.ID, "custom-id-123")
		}
	})

	t.Run("rejects duplicate ID", func(t *testing.T) {
		d1 := newTestDownload("https://youtube.com/watch?v=first")
		d1.ID = "dup-id"
		if err := repo.Create(d1); err != nil {
			t.Fatalf("first Create() should succeed: %v", err)
		}

		d2 := newTestDownload("https://youtube.com/watch?v=second")
		d2.ID = "dup-id"
		err := repo.Create(d2)
		if err == nil {
			t.Error("expected error for duplicate ID")
		}
	})
}

func TestDownloadRepository_GetByID(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	t.Run("returns download by ID", func(t *testing.T) {
		d := newTestDownload("https://youtube.com/watch?v=test")
		d.Title = "My Video"
		d.Duration = 300
		repo.Create(d)

		found, err := repo.GetByID(d.ID)
		if err != nil {
			t.Fatalf("GetByID() error: %v", err)
		}
		if found == nil {
			t.Fatal("expected download, got nil")
		}
		if found.Title != "My Video" {
			t.Errorf("Title = %q, want %q", found.Title, "My Video")
		}
		if found.Duration != 300 {
			t.Errorf("Duration = %d, want %d", found.Duration, 300)
		}
	})

	t.Run("returns nil for non-existent ID", func(t *testing.T) {
		found, err := repo.GetByID("non-existent")
		if err != nil {
			t.Fatalf("GetByID() error: %v", err)
		}
		if found != nil {
			t.Error("expected nil for non-existent ID")
		}
	})
}

func TestDownloadRepository_Update(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	d := newTestDownload("https://youtube.com/watch?v=update")
	repo.Create(d)

	// Update fields
	d.Status = StatusDownloading
	d.Progress = 50.5
	d.Speed = "5.2 MB/s"
	d.ETA = "2m 30s"
	now := time.Now()
	d.StartedAt = &now

	err := repo.Update(d)
	if err != nil {
		t.Fatalf("Update() error: %v", err)
	}

	// Verify
	found, _ := repo.GetByID(d.ID)
	if found.Status != StatusDownloading {
		t.Errorf("Status = %q, want %q", found.Status, StatusDownloading)
	}
	if found.Progress != 50.5 {
		t.Errorf("Progress = %f, want %f", found.Progress, 50.5)
	}
	if found.Speed != "5.2 MB/s" {
		t.Errorf("Speed = %q, want %q", found.Speed, "5.2 MB/s")
	}
}

func TestDownloadRepository_UpdateStatus(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	d := newTestDownload("https://youtube.com/watch?v=status")
	repo.Create(d)

	err := repo.UpdateStatus(d.ID, StatusCompleted)
	if err != nil {
		t.Fatalf("UpdateStatus() error: %v", err)
	}

	found, _ := repo.GetByID(d.ID)
	if found.Status != StatusCompleted {
		t.Errorf("Status = %q, want %q", found.Status, StatusCompleted)
	}
}

func TestDownloadRepository_UpdateProgress(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	d := newTestDownload("https://youtube.com/watch?v=progress")
	repo.Create(d)

	err := repo.UpdateProgress(d.ID, 75.0, "10 MB/s", "30s")
	if err != nil {
		t.Fatalf("UpdateProgress() error: %v", err)
	}

	found, _ := repo.GetByID(d.ID)
	if found.Progress != 75.0 {
		t.Errorf("Progress = %f, want %f", found.Progress, 75.0)
	}
}

func TestDownloadRepository_Delete(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	d := newTestDownload("https://youtube.com/watch?v=delete")
	repo.Create(d)

	err := repo.Delete(d.ID)
	if err != nil {
		t.Fatalf("Delete() error: %v", err)
	}

	found, _ := repo.GetByID(d.ID)
	if found != nil {
		t.Error("expected download to be deleted")
	}
}

// =============================================================================
// Queue and History Query Tests
// =============================================================================

func TestDownloadRepository_GetQueue(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	// Create mixed status downloads
	pending := newTestDownload("https://youtube.com/watch?v=pending")
	pending.Status = StatusPending
	repo.Create(pending)

	downloading := newTestDownload("https://youtube.com/watch?v=downloading")
	downloading.Status = StatusDownloading
	repo.Create(downloading)

	completed := newTestDownload("https://youtube.com/watch?v=completed")
	completed.Status = StatusCompleted
	repo.Create(completed)

	failed := newTestDownload("https://youtube.com/watch?v=failed")
	failed.Status = StatusFailed
	repo.Create(failed)

	queue, err := repo.GetQueue()
	if err != nil {
		t.Fatalf("GetQueue() error: %v", err)
	}

	// Should only include pending and downloading (not completed/failed)
	if len(queue) != 2 {
		t.Errorf("GetQueue() returned %d items, want 2", len(queue))
	}

	for _, d := range queue {
		if d.Status == StatusCompleted || d.Status == StatusFailed || d.Status == StatusCancelled {
			t.Errorf("GetQueue() should not include status %q", d.Status)
		}
	}
}

func TestDownloadRepository_GetHistory(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	// Create terminal status downloads
	for i := 0; i < 5; i++ {
		d := newTestDownload("https://youtube.com/watch?v=completed-" + string(rune('A'+i)))
		d.Status = StatusCompleted
		now := time.Now()
		d.CompletedAt = &now
		repo.Create(d)
	}

	// Create active download (should not appear in history)
	active := newTestDownload("https://youtube.com/watch?v=active")
	active.Status = StatusDownloading
	repo.Create(active)

	history, err := repo.GetHistory(3)
	if err != nil {
		t.Fatalf("GetHistory() error: %v", err)
	}

	if len(history) != 3 {
		t.Errorf("GetHistory(3) returned %d items, want 3", len(history))
	}

	for _, d := range history {
		if d.Status == StatusPending || d.Status == StatusDownloading {
			t.Errorf("GetHistory() should not include status %q", d.Status)
		}
	}
}

func TestDownloadRepository_GetPending(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	p := newTestDownload("https://youtube.com/watch?v=pending")
	p.Status = StatusPending
	repo.Create(p)

	dl := newTestDownload("https://youtube.com/watch?v=downloading")
	dl.Status = StatusDownloading
	repo.Create(dl)

	pending, err := repo.GetPending()
	if err != nil {
		t.Fatalf("GetPending() error: %v", err)
	}

	if len(pending) != 1 {
		t.Errorf("GetPending() returned %d items, want 1", len(pending))
	}
	if pending[0].Status != StatusPending {
		t.Errorf("expected pending status, got %q", pending[0].Status)
	}
}

func TestDownloadRepository_ClearHistory(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	// Terminal downloads
	completed := newTestDownload("https://youtube.com/watch?v=done")
	completed.Status = StatusCompleted
	repo.Create(completed)

	failed := newTestDownload("https://youtube.com/watch?v=fail")
	failed.Status = StatusFailed
	repo.Create(failed)

	// Active download (should survive)
	active := newTestDownload("https://youtube.com/watch?v=active")
	active.Status = StatusDownloading
	repo.Create(active)

	err := repo.ClearHistory()
	if err != nil {
		t.Fatalf("ClearHistory() error: %v", err)
	}

	// History should be empty
	history, _ := repo.GetHistory(100)
	if len(history) != 0 {
		t.Errorf("after ClearHistory(), history has %d items, want 0", len(history))
	}

	// Active download should survive
	queue, _ := repo.GetQueue()
	if len(queue) != 1 {
		t.Errorf("after ClearHistory(), queue has %d items, want 1", len(queue))
	}
}

func TestDownloadRepository_ExistsActiveByURL(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	url := "https://youtube.com/watch?v=dupcheck"

	t.Run("returns nil when no active download", func(t *testing.T) {
		found, err := repo.ExistsActiveByURL(url)
		if err != nil {
			t.Fatalf("error: %v", err)
		}
		if found != nil {
			t.Error("expected nil for non-existent URL")
		}
	})

	t.Run("returns download when active exists", func(t *testing.T) {
		d := newTestDownload(url)
		d.Status = StatusDownloading
		repo.Create(d)

		found, err := repo.ExistsActiveByURL(url)
		if err != nil {
			t.Fatalf("error: %v", err)
		}
		if found == nil {
			t.Fatal("expected active download, got nil")
		}
		if found.URL != url {
			t.Errorf("URL = %q, want %q", found.URL, url)
		}
	})

	t.Run("ignores completed downloads", func(t *testing.T) {
		completedURL := "https://youtube.com/watch?v=already-done"
		d := newTestDownload(completedURL)
		d.Status = StatusCompleted
		repo.Create(d)

		found, _ := repo.ExistsActiveByURL(completedURL)
		if found != nil {
			t.Error("should not find completed download as active")
		}
	})
}

func TestDownloadRepository_GetActive(t *testing.T) {
	db := setupTestDB(t)
	repo := NewDownloadRepository(db)

	// Downloading
	d1 := newTestDownload("https://youtube.com/watch?v=dl1")
	d1.Status = StatusDownloading
	repo.Create(d1)

	// Merging
	d2 := newTestDownload("https://youtube.com/watch?v=dl2")
	d2.Status = StatusMerging
	repo.Create(d2)

	// Pending (not active)
	d3 := newTestDownload("https://youtube.com/watch?v=dl3")
	d3.Status = StatusPending
	repo.Create(d3)

	active, err := repo.GetActive()
	if err != nil {
		t.Fatalf("GetActive() error: %v", err)
	}

	if len(active) != 2 {
		t.Errorf("GetActive() returned %d items, want 2", len(active))
	}
}

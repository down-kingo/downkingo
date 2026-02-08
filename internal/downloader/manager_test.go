package downloader

import (
	"context"
	"sync"
	"testing"
	"time"

	"kingo/internal/storage"
	"kingo/internal/youtube"
)

// =============================================================================
// Test Helpers
// =============================================================================

// testRepo creates a real DownloadRepository backed by an in-memory database.
func testRepo(t *testing.T) *storage.DownloadRepository {
	t.Helper()
	db, err := storage.New(t.TempDir())
	if err != nil {
		t.Fatalf("failed to create test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return storage.NewDownloadRepository(db)
}

// stubClient is a minimal youtube.Client substitute for tests.
// The Manager depends on *youtube.Client directly (not an interface),
// so we build a minimal test helper that exercises the Manager's logic
// without spawning yt-dlp.
//
// Since Manager.processJob calls m.client.GetVideoInfo and m.client.Download,
// and those are not behind an interface, we test the Manager's coordination
// logic (AddJob, CancelJob, queue behavior) using the real repo and checking
// database state.

// =============================================================================
// AddJob Tests
// =============================================================================

func TestManager_AddJob_CreatesDownload(t *testing.T) {
	repo := testRepo(t)

	// Create manager but don't start the worker loop (we test AddJob logic only)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	opts := youtube.DownloadOptions{
		URL:       "https://youtube.com/watch?v=test1",
		Format:    "720p",
		AudioOnly: false,
		Title:     "Test Video",
	}

	download, err := m.AddJob(opts)
	if err != nil {
		t.Fatalf("AddJob() error: %v", err)
	}

	if download.ID == "" {
		t.Error("expected generated ID")
	}
	if download.URL != opts.URL {
		t.Errorf("URL = %q, want %q", download.URL, opts.URL)
	}
	if download.Status != storage.StatusPending {
		t.Errorf("Status = %q, want %q", download.Status, storage.StatusPending)
	}

	// Verify persisted to database
	found, _ := repo.GetByID(download.ID)
	if found == nil {
		t.Fatal("download should be persisted in database")
	}

	// Verify tracked in jobs map
	m.mu.RLock()
	_, tracked := m.jobs[download.ID]
	m.mu.RUnlock()
	if !tracked {
		t.Error("job should be tracked in jobs map")
	}
}

func TestManager_AddJob_PreventsDuplicateURL(t *testing.T) {
	repo := testRepo(t)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	url := "https://youtube.com/watch?v=dup"

	// First add
	first, err := m.AddJob(youtube.DownloadOptions{URL: url})
	if err != nil {
		t.Fatalf("first AddJob() error: %v", err)
	}

	// Second add of same URL should return existing
	second, err := m.AddJob(youtube.DownloadOptions{URL: url})
	if err != nil {
		t.Fatalf("second AddJob() error: %v", err)
	}

	if first.ID != second.ID {
		t.Errorf("duplicate URL should return same download: first=%q, second=%q", first.ID, second.ID)
	}
}

func TestManager_AddJob_ConcurrentSafety(t *testing.T) {
	repo := testRepo(t)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	var wg sync.WaitGroup
	errors := make(chan error, 10)

	// Add 10 different URLs concurrently
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			url := "https://youtube.com/watch?v=concurrent-" + string(rune('A'+idx))
			_, err := m.AddJob(youtube.DownloadOptions{URL: url})
			if err != nil {
				errors <- err
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	for err := range errors {
		t.Errorf("concurrent AddJob() error: %v", err)
	}

	// All should be tracked
	m.mu.RLock()
	count := len(m.jobs)
	m.mu.RUnlock()
	if count != 10 {
		t.Errorf("tracked %d jobs, want 10", count)
	}
}

// =============================================================================
// CancelJob Tests
// =============================================================================

func TestManager_CancelJob_UpdatesStatus(t *testing.T) {
	repo := testRepo(t)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	download, _ := m.AddJob(youtube.DownloadOptions{URL: "https://youtube.com/watch?v=cancel-test"})

	err := m.CancelJob(download.ID)
	if err != nil {
		t.Fatalf("CancelJob() error: %v", err)
	}

	// Verify database status
	found, _ := repo.GetByID(download.ID)
	if found.Status != storage.StatusCancelled {
		t.Errorf("Status = %q, want %q", found.Status, storage.StatusCancelled)
	}
}

func TestManager_CancelJob_CancelsContext(t *testing.T) {
	repo := testRepo(t)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	download, _ := m.AddJob(youtube.DownloadOptions{URL: "https://youtube.com/watch?v=ctx-cancel"})

	// Get job context before cancellation
	m.mu.RLock()
	job := m.jobs[download.ID]
	m.mu.RUnlock()

	// Context should not be done yet
	select {
	case <-job.Ctx.Done():
		t.Fatal("context should not be done before cancel")
	default:
		// ok
	}

	m.CancelJob(download.ID)

	// Context should be cancelled
	select {
	case <-job.Ctx.Done():
		// ok, context was cancelled
	case <-time.After(time.Second):
		t.Error("expected context to be cancelled after CancelJob")
	}
}

func TestManager_CancelJob_NonExistentJob(t *testing.T) {
	repo := testRepo(t)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	// Should not panic, just update DB status (even if no record)
	err := m.CancelJob("non-existent-id")
	if err != nil {
		// It's ok to get an error here since the ID doesn't exist in DB
		// The important thing is no panic
	}
}

// =============================================================================
// Queue and History Delegation Tests
// =============================================================================

func TestManager_GetQueue(t *testing.T) {
	repo := testRepo(t)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	m.AddJob(youtube.DownloadOptions{URL: "https://youtube.com/watch?v=q1"})
	m.AddJob(youtube.DownloadOptions{URL: "https://youtube.com/watch?v=q2"})

	queue, err := m.GetQueue()
	if err != nil {
		t.Fatalf("GetQueue() error: %v", err)
	}
	if len(queue) != 2 {
		t.Errorf("GetQueue() returned %d items, want 2", len(queue))
	}
}

func TestManager_GetHistory_Empty(t *testing.T) {
	repo := testRepo(t)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	history, err := m.GetHistory(50)
	if err != nil {
		t.Fatalf("GetHistory() error: %v", err)
	}
	if len(history) != 0 {
		t.Errorf("GetHistory() returned %d items, want 0", len(history))
	}
}

func TestManager_ClearHistory(t *testing.T) {
	repo := testRepo(t)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	// Create and complete a download manually in DB
	d := &storage.Download{
		URL:    "https://youtube.com/watch?v=hist",
		Status: storage.StatusCompleted,
	}
	repo.Create(d)

	history, _ := m.GetHistory(50)
	if len(history) != 1 {
		t.Fatalf("expected 1 history item, got %d", len(history))
	}

	err := m.ClearHistory()
	if err != nil {
		t.Fatalf("ClearHistory() error: %v", err)
	}

	history, _ = m.GetHistory(50)
	if len(history) != 0 {
		t.Errorf("after ClearHistory(), got %d items, want 0", len(history))
	}
}

// =============================================================================
// NewManager Tests
// =============================================================================

func TestNewManager_DefaultsConcurrency(t *testing.T) {
	repo := testRepo(t)

	m := NewManager(repo, nil, 0) // 0 should default to 3
	if m.maxConcurrent != 3 {
		t.Errorf("maxConcurrent = %d, want 3", m.maxConcurrent)
	}

	m2 := NewManager(repo, nil, -1) // negative should default to 3
	if m2.maxConcurrent != 3 {
		t.Errorf("maxConcurrent = %d, want 3", m2.maxConcurrent)
	}

	m3 := NewManager(repo, nil, 5)
	if m3.maxConcurrent != 5 {
		t.Errorf("maxConcurrent = %d, want 5", m3.maxConcurrent)
	}
}

// =============================================================================
// Cleanup Tests
// =============================================================================

func TestManager_CleanupJob(t *testing.T) {
	repo := testRepo(t)
	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	download, _ := m.AddJob(youtube.DownloadOptions{URL: "https://youtube.com/watch?v=cleanup"})

	m.mu.RLock()
	_, exists := m.jobs[download.ID]
	m.mu.RUnlock()
	if !exists {
		t.Fatal("job should exist before cleanup")
	}

	m.cleanupJob(download.ID)

	m.mu.RLock()
	_, exists = m.jobs[download.ID]
	m.mu.RUnlock()
	if exists {
		t.Error("job should be removed after cleanup")
	}
}

// =============================================================================
// RestorePendingJobs Tests
// =============================================================================

func TestManager_RestorePendingJobs(t *testing.T) {
	repo := testRepo(t)

	// Create pending downloads directly in DB
	d1 := &storage.Download{URL: "https://youtube.com/watch?v=restore1", Status: storage.StatusPending, Format: "best"}
	repo.Create(d1)
	d2 := &storage.Download{URL: "https://youtube.com/watch?v=restore2", Status: storage.StatusPending, Format: "best"}
	repo.Create(d2)

	// Completed download should not be restored
	d3 := &storage.Download{URL: "https://youtube.com/watch?v=done", Status: storage.StatusCompleted}
	repo.Create(d3)

	m := &Manager{
		ctx:           context.Background(),
		repo:          repo,
		maxConcurrent: 3,
		queue:         make(chan *Job, 100),
		activeSlots:   make(chan struct{}, 3),
		jobs:          make(map[string]*Job),
		quit:          make(chan struct{}),
	}

	m.restorePendingJobs()

	m.mu.RLock()
	jobCount := len(m.jobs)
	m.mu.RUnlock()

	if jobCount != 2 {
		t.Errorf("restored %d jobs, want 2", jobCount)
	}

	// Queue should have 2 items
	if len(m.queue) != 2 {
		t.Errorf("queue has %d items, want 2", len(m.queue))
	}
}

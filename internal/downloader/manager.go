package downloader

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"kingo/internal/events"
	"kingo/internal/logger"
	"kingo/internal/storage"
	"kingo/internal/youtube"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Job represents a download job in the queue
type Job struct {
	Download *storage.Download
	Options  youtube.DownloadOptions // Full download options
	Ctx      context.Context
	Cancel   context.CancelFunc
}

// Manager coordinates download jobs with controlled concurrency
type Manager struct {
	ctx           context.Context
	repo          *storage.DownloadRepository
	client        *youtube.Client
	maxConcurrent int

	queue     chan *Job
	jobs      map[string]*Job
	mu        sync.RWMutex
	quit      chan struct{}
	wg        sync.WaitGroup
	startOnce sync.Once
	stopOnce  sync.Once

	// Metrics
	totalCompleted atomic.Int64
	totalFailed    atomic.Int64

	// Batched progress: stores latest progress per job. The signal-driven
	// flusher stays asleep while there are no active progress updates.
	pendingProgress map[string]map[string]interface{}
	progressMu      sync.Mutex
	progressSignal  chan struct{}
}

// NewManager creates a new download manager
func NewManager(repo *storage.DownloadRepository, client *youtube.Client, maxConcurrent int) *Manager {
	if maxConcurrent < 1 {
		maxConcurrent = 3
	}

	return &Manager{
		repo:            repo,
		client:          client,
		maxConcurrent:   maxConcurrent,
		queue:           make(chan *Job, 100), // Buffered to not block UI
		jobs:            make(map[string]*Job),
		quit:            make(chan struct{}),
		pendingProgress: make(map[string]map[string]interface{}),
		progressSignal:  make(chan struct{}, 1),
	}
}

// SetContext sets the context (kept for interface compatibility)
func (m *Manager) SetContext(ctx context.Context) {
	m.ctx = ctx
}

// Start begins the worker pool processing loop
func (m *Manager) Start() {
	m.startOnce.Do(func() {
		logger.Log.Info().Int("maxConcurrent", m.maxConcurrent).Msg("download manager started")

		// Fixed workers avoid creating a goroutine for every queued item and make
		// shutdown deterministic even when the queue is at capacity.
		m.wg.Add(m.maxConcurrent + 2)
		for range m.maxConcurrent {
			go func() {
				defer m.wg.Done()
				m.workerLoop()
			}()
		}
		go func() {
			defer m.wg.Done()
			m.logStatsLoop()
		}()
		go func() {
			defer m.wg.Done()
			m.flushProgressLoop()
		}()

		// Workers must be running before restoration; otherwise more than 100
		// persisted jobs would fill the queue and deadlock startup.
		m.restorePendingJobs()
	})
}

// Stop gracefully shuts down the manager
func (m *Manager) Stop() {
	m.stopOnce.Do(func() {
		close(m.quit)

		m.mu.RLock()
		cancels := make([]context.CancelFunc, 0, len(m.jobs))
		for _, job := range m.jobs {
			if job.Cancel != nil {
				cancels = append(cancels, job.Cancel)
			}
		}
		m.mu.RUnlock()
		for _, cancel := range cancels {
			cancel()
		}

		m.wg.Wait()
		m.flushPendingProgress()
		logger.Log.Info().Msg("download manager stopped")
	})
}

func (m *Manager) workerLoop() {
	for {
		select {
		case <-m.quit:
			return
		case job := <-m.queue:
			if job != nil {
				m.processJob(job)
			}
		}
	}
}

// AddJob creates a new download job and adds it to the queue
func (m *Manager) AddJob(opts youtube.DownloadOptions) (*storage.Download, error) {
	// Check if there's already an active download for this URL
	existing, err := m.repo.ExistsActiveByURL(opts.URL)
	if err != nil {
		logger.Log.Warn().Err(err).Msg("failed to check for existing download")
		// Continue anyway, this is just a safeguard
	}
	if existing != nil {
		logger.Log.Info().
			Str("id", existing.ID).
			Str("url", opts.URL).
			Msg("download already in queue, skipping duplicate")
		m.emitLog(existing.ID, "[Fila] O download já está na fila.")
		return existing, nil // Return existing instead of creating new
	}

	download := &storage.Download{
		URL:       opts.URL,
		Title:     opts.Title,
		Thumbnail: opts.Thumbnail,
		Format:    opts.Format,
		AudioOnly: opts.AudioOnly,
		Status:    storage.StatusPending,
	}

	// Save to database first
	if err := m.repo.Create(download); err != nil {
		return nil, err
	}

	// Create job context for cancellation
	ctx, cancel := context.WithCancel(m.ctx)
	job := &Job{
		Download: download,
		Options:  opts,
		Ctx:      ctx,
		Cancel:   cancel,
	}

	// Track job
	m.mu.Lock()
	m.jobs[download.ID] = job
	m.mu.Unlock()

	// Emit event for UI
	m.emitJobAdded(download)
	m.emitLog(download.ID, fmt.Sprintf("[Fila] Download adicionado: %s", diagnosticLabel(download.Title)))

	// Feedback imediato: Se já temos título/thumb, manda progresso 0%
	if download.Title != "" {
		m.emitDetailedProgress(download.ID, youtube.DownloadProgress{
			Status:  "downloading",
			Percent: 0,
		})
	}

	// Add to queue
	select {
	case m.queue <- job:
	case <-m.quit:
		job.Cancel()
		m.cleanupJob(download.ID)
		_ = m.repo.Delete(download.ID)
		return nil, fmt.Errorf("download manager is shutting down")
	}

	logger.Log.Info().
		Str("traceID", download.ID).
		Str("phase", "enqueue").
		Str("url", opts.URL).
		Bool("audioOnly", opts.AudioOnly).
		Msg("job added to queue")

	return download, nil
}

// CancelJob cancels a specific download
func (m *Manager) CancelJob(id string) error {
	logger.Log.Info().Str("id", id).Msg("cancel download requested by user")

	m.mu.RLock()
	job, exists := m.jobs[id]
	m.mu.RUnlock()

	if exists && job.Cancel != nil {
		logger.Log.Info().Str("id", id).Msg("cancelling context for job")
		job.Cancel()
	} else {
		logger.Log.Warn().Str("id", id).Msg("job to cancel not found or has no cancel function")
	}

	// Update database
	return m.repo.UpdateStatus(id, storage.StatusCancelled)
}

// GetQueue returns all queued and active downloads
func (m *Manager) GetQueue() ([]*storage.Download, error) {
	return m.repo.GetQueue()
}

// GetHistory returns completed downloads
func (m *Manager) GetHistory(limit int) ([]*storage.Download, error) {
	return m.repo.GetHistory(limit)
}

// ClearHistory removes all completed/failed/cancelled downloads
func (m *Manager) ClearHistory() error {
	return m.repo.ClearHistory()
}

// processJob handles a single download job
func (m *Manager) processJob(job *Job) {
	download := job.Download

	logger.Log.Info().
		Str("traceID", download.ID).
		Str("phase", "start").
		Str("url", download.URL).
		Msg("processing job")
	m.emitLog(download.ID, "[Download] Preparando o trabalho e validando as opções...")

	// Feedback imediato: Mudando status para downloading (0%) enquanto busca info
	download.Status = storage.StatusDownloading
	m.emitDetailedProgress(download.ID, youtube.DownloadProgress{
		Status:  "downloading",
		Percent: 0,
	})

	// Fetch video info first
	m.emitLog(download.ID, "[Metadados] Consultando informações atualizadas da mídia...")
	var info *youtube.VideoInfo
	var err error
	if job.Options.CookieBrowser != "" {
		info, err = m.client.GetVideoInfoWithCookies(job.Ctx, download.URL, job.Options.CookieBrowser)
	} else {
		info, err = m.client.GetVideoInfo(job.Ctx, download.URL)
	}
	if err != nil {
		m.emitLog(download.ID, "[Metadados] ✗ Não foi possível preparar a mídia.")
		// Se falhou porque o usuário cancelou, use cancelJob
		select {
		case <-job.Ctx.Done():
			m.cancelJob(download)
		default:
			m.failJob(download, err.Error())
		}
		return
	}

	// Update download with metadata
	download.Title = info.Title
	download.Thumbnail = info.Thumbnail
	download.Duration = int(info.Duration)
	download.Uploader = info.Uploader
	download.Status = storage.StatusDownloading
	now := time.Now()
	download.StartedAt = &now

	if err := m.repo.Update(download); err != nil {
		logger.Log.Error().Err(err).Str("id", download.ID).Msg("failed to update download")
	}

	m.emitProgress(download)
	m.emitLog(download.ID, fmt.Sprintf("[Metadados] ✓ Mídia confirmada: %s", diagnosticLabel(download.Title)))

	// Use the full options stored in the job
	opts := job.Options
	opts.URL = download.URL // Ensure URL is set

	// Check for cancellation
	select {
	case <-job.Ctx.Done():
		m.cancelJob(download)
		return
	default:
	}

	// ═══════════════════════════════════════════════════════════════════════
	// CALLBACKS COM CONTEXTO (Job ID)
	// Resolve o problema de múltiplos downloads simultâneos
	// ═══════════════════════════════════════════════════════════════════════
	onProgress := func(p youtube.DownloadProgress) {
		// Atualizar estado local
		download.Progress = p.Percent
		download.Speed = p.Speed
		download.ETA = p.ETA

		// Emitir evento COM o ID do job
		m.emitDetailedProgress(download.ID, p)
	}

	onLog := func(line string) {
		// Emitir log COM o ID do job
		m.emitLog(download.ID, line)
	}

	// Execute download (blocking) com callbacks e contexto de cancelamento
	mediaType := "vídeo"
	if opts.AudioOnly {
		mediaType = "áudio"
	}
	m.emitLog(download.ID, fmt.Sprintf("[Download] Iniciando transferência de %s...", mediaType))
	if err := m.client.Download(job.Ctx, opts, onProgress, onLog); err != nil {
		// Check if cancelled
		select {
		case <-job.Ctx.Done():
			m.cancelJob(download)
			return
		default:
			m.failJob(download, err.Error())
			return
		}
	}

	// Success
	m.completeJob(download)
}

func (m *Manager) failJob(download *storage.Download, errMsg string) {
	// Check specifically for Incognito BEFORE cleaning up map
	m.mu.RLock()
	job, exists := m.jobs[download.ID]
	m.mu.RUnlock()

	download.Status = storage.StatusFailed
	download.ErrorMessage = errMsg
	now := time.Now()
	download.CompletedAt = &now

	if exists && job.Options.Incognito {
		// Incognito: Delete record immediately
		if err := m.repo.Delete(download.ID); err != nil {
			logger.Log.Error().Err(err).Str("id", download.ID).Msg("failed to delete incognito download")
		}
		// Still emit event so UI knows it finished (but won't find it in history)
		m.emitProgress(download)
	} else {
		// Normal: Update record
		if err := m.repo.Update(download); err != nil {
			logger.Log.Error().Err(err).Str("id", download.ID).Msg("failed to persist failed download")
		}
		m.emitProgress(download)
	}

	m.cleanupJob(download.ID)
	m.totalFailed.Add(1)

	logger.Log.Error().
		Str("traceID", download.ID).
		Str("phase", "failed").
		Str("error", errMsg).
		Msg("job failed")
}

func (m *Manager) cancelJob(download *storage.Download) {
	m.mu.RLock()
	job, exists := m.jobs[download.ID]
	m.mu.RUnlock()

	download.Status = storage.StatusCancelled
	now := time.Now()
	download.CompletedAt = &now

	if exists && job.Options.Incognito {
		if err := m.repo.Delete(download.ID); err != nil {
			logger.Log.Error().Err(err).Str("id", download.ID).Msg("failed to delete incognito download")
		}
		m.emitProgress(download)
	} else {
		if err := m.repo.Update(download); err != nil {
			logger.Log.Error().Err(err).Str("id", download.ID).Msg("failed to persist cancelled download")
		}
		m.emitProgress(download)
	}

	m.cleanupJob(download.ID)

	logger.Log.Info().Str("traceID", download.ID).Str("phase", "cancelled").Msg("job cancelled")
}

func (m *Manager) completeJob(download *storage.Download) {
	m.mu.RLock()
	job, exists := m.jobs[download.ID]
	m.mu.RUnlock()

	download.Status = storage.StatusCompleted
	download.Progress = 100
	now := time.Now()
	download.CompletedAt = &now

	if exists && job.Options.Incognito {
		// Incognito: Delete record immediately
		if err := m.repo.Delete(download.ID); err != nil {
			logger.Log.Error().Err(err).Str("id", download.ID).Msg("failed to delete incognito download")
		}
		// Still emit event so UI knows it finished
		m.emitProgress(download)
	} else {
		// Normal: Update record
		if err := m.repo.Update(download); err != nil {
			logger.Log.Error().Err(err).Str("id", download.ID).Msg("failed to persist completed download")
		}
		m.emitProgress(download)
	}

	m.cleanupJob(download.ID)
	m.totalCompleted.Add(1)

	logger.Log.Info().
		Str("traceID", download.ID).
		Str("phase", "completed").
		Str("title", download.Title).
		Msg("job completed")
}

func (m *Manager) cleanupJob(id string) {
	m.mu.Lock()
	job := m.jobs[id]
	delete(m.jobs, id)
	m.mu.Unlock()
	if job != nil && job.Cancel != nil {
		job.Cancel()
	}
}

// restorePendingJobs loads pending jobs from database on startup
func (m *Manager) restorePendingJobs() {
	pending, err := m.repo.GetPending()
	if err != nil {
		logger.Log.Error().Err(err).Msg("failed to restore pending jobs")
		return
	}

	for _, download := range pending {
		ctx, cancel := context.WithCancel(m.ctx)

		// Reconstruct Options from stored Download data
		opts := youtube.DownloadOptions{
			URL:       download.URL,
			Format:    download.Format,
			AudioOnly: download.AudioOnly,
			Title:     download.Title,
			Thumbnail: download.Thumbnail,
			// Note: Advanced options like UseAria2c, Incognito, etc. are not persisted
			// They will use defaults. To fully persist, expand the downloads table schema.
		}

		job := &Job{
			Download: download,
			Options:  opts,
			Ctx:      ctx,
			Cancel:   cancel,
		}

		m.mu.Lock()
		m.jobs[download.ID] = job
		m.mu.Unlock()

		select {
		case m.queue <- job:
		case <-m.quit:
			cancel()
			m.cleanupJob(download.ID)
			return
		}
	}

	if len(pending) > 0 {
		logger.Log.Info().Int("count", len(pending)).Msg("restored pending jobs")
	}
}

// logStatsLoop periodically logs manager metrics for observability.
func (m *Manager) logStatsLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			m.mu.RLock()
			activeJobs := len(m.jobs)
			m.mu.RUnlock()
			queueLen := len(m.queue)

			logger.Log.Info().
				Int("activeJobs", activeJobs).
				Int("queueLen", queueLen).
				Int64("totalCompleted", m.totalCompleted.Load()).
				Int64("totalFailed", m.totalFailed.Load()).
				Msg("manager stats")
		case <-m.quit:
			return
		}
	}
}

// emitEvent is a helper to emit events using Wails v3 API.
// Safe for tests where application.Get() may return nil.
func (m *Manager) emitEvent(eventName string, data any) {
	if app := application.Get(); app != nil {
		app.Event.Emit(eventName, data)
	}
}

// emitJobAdded emits an event when a job is added
func (m *Manager) emitJobAdded(download *storage.Download) {
	m.emitEvent(events.DownloadAdded, download)
}

// emitProgress emits download progress/status updates
func (m *Manager) emitProgress(download *storage.Download) {
	if download.Status == storage.StatusCompleted ||
		download.Status == storage.StatusFailed ||
		download.Status == storage.StatusCancelled {
		m.discardPendingProgress(download.ID)
	}
	diagnosticError := ""
	if download.ErrorMessage != "" {
		diagnosticError = diagnosticLabel(download.ErrorMessage)
	}
	m.emitEvent(events.DownloadProgress, map[string]interface{}{
		"id":        download.ID,
		"status":    download.Status,
		"progress":  download.Progress,
		"speed":     download.Speed,
		"eta":       download.ETA,
		"title":     download.Title,
		"thumbnail": download.Thumbnail,
		"error":     diagnosticError,
	})
}

// emitDetailedProgress buffers progress updates to be flushed every 50ms.
// This reduces frontend event thrashing during rapid yt-dlp output.
func (m *Manager) emitDetailedProgress(jobID string, p youtube.DownloadProgress) {
	m.mu.RLock()
	job, exists := m.jobs[jobID]
	m.mu.RUnlock()

	thumbnail := ""
	title := ""
	if exists && job.Download != nil {
		thumbnail = job.Download.Thumbnail
		title = job.Download.Title
	}

	data := map[string]interface{}{
		"id":        jobID,
		"status":    p.Status,
		"progress":  p.Percent,
		"speed":     p.Speed,
		"eta":       p.ETA,
		"thumbnail": thumbnail,
		"title":     title,
	}

	// Immediate states supersede any older buffered download update. Without
	// clearing it, a stale "downloading" event can arrive after "completed".
	if p.Status == "merging" || p.Status == "completed" ||
		p.Status == "failed" || p.Status == "cancelled" {
		m.discardPendingProgress(jobID)
		m.emitEvent(events.DownloadProgress, data)
		return
	}

	m.progressMu.Lock()
	m.pendingProgress[jobID] = data
	m.progressMu.Unlock()
	select {
	case m.progressSignal <- struct{}{}:
	default:
	}
}

func (m *Manager) discardPendingProgress(jobID string) {
	m.progressMu.Lock()
	delete(m.pendingProgress, jobID)
	m.progressMu.Unlock()
}

// flushProgressLoop batches active updates without a permanently ticking timer.
func (m *Manager) flushProgressLoop() {
	timer := time.NewTimer(time.Hour)
	if !timer.Stop() {
		<-timer.C
	}
	defer timer.Stop()
	armed := false

	for {
		select {
		case <-m.progressSignal:
			if !armed {
				timer.Reset(50 * time.Millisecond)
				armed = true
			}
		case <-timer.C:
			armed = false
			m.flushPendingProgress()
		case <-m.quit:
			return
		}
	}
}

// flushPendingProgress emits all buffered progress events
func (m *Manager) flushPendingProgress() {
	m.progressMu.Lock()
	if len(m.pendingProgress) == 0 {
		m.progressMu.Unlock()
		return
	}
	pending := m.pendingProgress
	m.pendingProgress = make(map[string]map[string]interface{})
	m.progressMu.Unlock()

	for _, data := range pending {
		m.emitEvent(events.DownloadProgress, data)
	}
}

// emitLog emite log com ID do job (para Terminal)
func (m *Manager) emitLog(jobID string, line string) {
	m.emitEvent(events.DownloadLog, map[string]interface{}{
		"id":   jobID,
		"line": line,
	})
}

func diagnosticLabel(value string) string {
	value = strings.Join(strings.Fields(value), " ")
	if value == "" {
		return "mídia sem título"
	}
	const maxLength = 500
	runes := []rune(value)
	if len(runes) > maxLength {
		return string(runes[:maxLength]) + "…"
	}
	return value
}

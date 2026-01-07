package roadmap

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"kingo/internal/config"
	"kingo/internal/logger"
	"math/rand"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Status represents the state of a roadmap item
type Status string

const (
	StatusIdeia      Status = "idea"
	StatusPlanned    Status = "planned"
	StatusInProgress Status = "in-progress"
	StatusShipped    Status = "shipped"
)

// RoadmapItem represents a single feature or task in the roadmap (frontend contract)
type RoadmapItem struct {
	ID            int               `json:"id"`
	Title         string            `json:"title"`
	FriendlyTitle string            `json:"friendly_title,omitempty"`
	TitleI18n     map[string]string `json:"title_i18n,omitempty"`
	Description   string            `json:"description"`
	Status        Status            `json:"status"`
	Votes         int               `json:"votes"`
	VotesUp       int               `json:"votes_up,omitempty"`
	VotesDown     int               `json:"votes_down,omitempty"`
	Comments      int               `json:"comments"`
	URL           string            `json:"url"`
	Labels        []string          `json:"labels"`
	Author        string            `json:"author"`
	AuthorAvatar  string            `json:"author_avatar"`
	CreatedAt     string            `json:"created_at"`
	ShippedAt     string            `json:"shipped_at,omitempty"`
}

// TokenProvider is a function that returns the current auth token
type TokenProvider func() string

// EventEmitter is a function that emits events to the frontend
type EventEmitter func(eventName string, data interface{})

// Service handles roadmap data with CDN-first + local cache architecture
type Service struct {
	// Configuration
	repoOwner     string
	repoName      string
	projectNumber int
	config        Config

	// Dependencies
	tokenProvider TokenProvider
	eventEmitter  EventEmitter
	cacheRepo     *CacheRepository
	cdnFetcher    *CDNFetcher

	// State
	cache      []RoadmapItem
	cacheLang  string // Language of cached data
	lastFetch  time.Time
	lastETag   string
	syncState  SyncState
	mu         sync.RWMutex
	syncMu     sync.Mutex
	ctx        context.Context
	cancelSync context.CancelFunc
	useCDN     bool // Toggle between CDN and direct GitHub
	isFetching atomic.Bool
}

// statusMapping maps GitHub Project column names to internal Status types
var statusMapping = map[string]Status{
	"bastidores":  StatusIdeia,
	"em pauta":    StatusPlanned,
	"em produção": StatusInProgress,
	"no ar":       StatusShipped,
	"backlog":     StatusIdeia,
	"todo":        StatusIdeia,
	"ready":       StatusPlanned,
	"planned":     StatusPlanned,
	"in progress": StatusInProgress,
	"in_progress": StatusInProgress,
	"done":        StatusShipped,
	"shipped":     StatusShipped,
	"completed":   StatusShipped,
}

// NewService creates a new roadmap service instance
func NewService(owner, name string) *Service {
	cfg := DefaultConfig()
	return &Service{
		repoOwner:     owner,
		repoName:      name,
		projectNumber: 2,
		config:        cfg,
		cdnFetcher:    NewCDNFetcher(cfg),
		useCDN:        false, // Safe default: use direct GitHub API until config enables CDN
	}
}

// ApplyConfig applies external configuration (from config.Config)
func (s *Service) ApplyConfig(roadmapCfg config.RoadmapConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.useCDN = roadmapCfg.CDNEnabled

	// Update CDN URLs if custom base URL is provided
	if roadmapCfg.CDNBaseURL != "" {
		baseURL := sanitizeCDNURL(roadmapCfg.CDNBaseURL)
		if baseURL != "" {
			s.config.CDNURL = baseURL
			s.config.MetaURL = baseURL + "/roadmap.meta.json"
			s.config.JSONUrl = baseURL + "/roadmap.json"
			s.cdnFetcher = NewCDNFetcher(s.config)
		} else {
			logger.Log.Warn().
				Str("rawUrl", maskURL(roadmapCfg.CDNBaseURL)).
				Msg("invalid CDN URL provided, using default")
		}
	}

	// Log only the host (never full URL with potential paths/tokens)
	cdnHost := extractHost(s.config.CDNURL)
	logger.Log.Info().
		Bool("cdnEnabled", roadmapCfg.CDNEnabled).
		Str("cdnHost", cdnHost).
		Msg("roadmap config applied")
}

// sanitizeCDNURL validates and normalizes CDN base URL
// Returns empty string if invalid
func sanitizeCDNURL(rawURL string) string {
	// Must start with https://
	if !strings.HasPrefix(rawURL, "https://") {
		return ""
	}

	// Parse and validate
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}

	// Must have a host
	if parsed.Host == "" {
		return ""
	}

	// Reject URLs with query strings (could be injection vector)
	if parsed.RawQuery != "" {
		return ""
	}

	// Rebuild clean URL: scheme + host only (no path, no query)
	cleanURL := parsed.Scheme + "://" + parsed.Host

	// Remove trailing slash if present in original
	return strings.TrimSuffix(cleanURL, "/")
}

// extractHost returns only the host portion of a URL for safe logging
func extractHost(urlStr string) string {
	parsed, err := url.Parse(urlStr)
	if err != nil {
		return "invalid"
	}
	return parsed.Host
}

// maskURL masks the URL for safe logging (shows only scheme and host)
func maskURL(urlStr string) string {
	if len(urlStr) > 50 {
		return urlStr[:50] + "..."
	}
	return urlStr
}

// SetDB configures the SQLite database for caching
func (s *Service) SetDB(db *sql.DB) {
	s.cacheRepo = NewCacheRepository(db)
	// Run migration
	if err := s.cacheRepo.Migrate(); err != nil {
		logger.Log.Warn().Err(err).Msg("roadmap cache migration failed")
	}
}

// SetTokenProvider sets the function implementation to retrieve the auth token
func (s *Service) SetTokenProvider(provider TokenProvider) {
	s.tokenProvider = provider
}

// SetEventEmitter sets the function to emit events to the frontend
func (s *Service) SetEventEmitter(emitter EventEmitter) {
	s.eventEmitter = emitter
}

// SetContext sets the context for background operations
func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// EnableCDN enables CDN-first mode (runtime override)
func (s *Service) EnableCDN(enabled bool) {
	s.mu.Lock()
	s.useCDN = enabled
	s.mu.Unlock()
}

// FetchRoadmap retrieves items with Stale-While-Revalidate pattern:
// 1. Returns cached data immediately (instant UI)
// 2. Triggers background sync to CDN
// 3. Emits "roadmap:update" event when new data arrives
func (s *Service) FetchRoadmap(lang string) ([]RoadmapItem, error) {
	// Step 1: Try to return cached data immediately
	cachedItems := s.loadFromMemoryCache(lang)
	if len(cachedItems) > 0 {
		// Trigger background sync (non-blocking)
		go s.syncInBackground("startup", lang)
		return cachedItems, nil
	}

	// Step 2: Try SQLite cache if memory is empty
	if s.cacheRepo != nil {
		dbItems, err := s.loadFromDatabaseCache(lang)
		if err == nil && len(dbItems) > 0 {
			s.updateMemoryCache(dbItems, lang)
			go s.syncInBackground("startup", lang)
			return dbItems, nil
		}
	}

	// Step 3: No cache - must fetch synchronously
	s.mu.RLock()
	useCDN := s.useCDN
	s.mu.RUnlock()

	logger.Log.Debug().Bool("useCDN", useCDN).Msg("FetchRoadmap: no cache, fetching synchronously")

	if useCDN {
		return s.fetchFromCDNSync(lang)
	}

	// Fallback to direct GitHub (requires auth)
	return s.fetchFromGitHubDirect()
}

// loadFromMemoryCache returns in-memory cached items if fresh and matching language
func (s *Service) loadFromMemoryCache(lang string) []RoadmapItem {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Memory cache valid for 2 minutes AND language match
	if s.cacheLang == lang && time.Since(s.lastFetch) < 2*time.Minute && len(s.cache) > 0 {
		return s.cache
	}
	return nil
}

// loadFromDatabaseCache loads items from SQLite and verifies language
func (s *Service) loadFromDatabaseCache(lang string) ([]RoadmapItem, error) {
	if s.cacheRepo == nil {
		return nil, errors.New("cache repo not initialized")
	}

	// Load raw JSON blob
	cache, err := s.cacheRepo.Load()
	if err != nil {
		return nil, err
	}

	// Parse JSON
	roadmap, err := s.cacheRepo.ParseCachedData(cache)
	if err != nil {
		logger.Log.Error().Err(err).Msg("failed to parse cached roadmap")
		return nil, err
	}

	// Validate language
	if roadmap.Lang != lang {
		// Cache mismatch - ignore it (will trigger re-fetch)
		logger.Log.Debug().
			Str("want", lang).
			Str("got", roadmap.Lang).
			Msg("roadmap cache language mismatch, ignoring")
		return nil, nil
	}

	return ToRoadmapItems(roadmap.Items), nil
}

// updateMemoryCache updates the in-memory cache
func (s *Service) updateMemoryCache(items []RoadmapItem, lang string) {
	s.mu.Lock()
	s.cache = items
	s.cacheLang = lang
	s.lastFetch = time.Now()
	s.mu.Unlock()
}

// syncInBackground updates data from source and emits event if changed
func (s *Service) syncInBackground(reason string, lang string) {
	if s.isFetching.Load() {
		return
	}
	s.isFetching.Store(true)
	defer s.isFetching.Store(false)

	logger.Log.Debug().Str("reason", reason).Msg("Starting background sync")

	// Apply jitter to prevent thundering herd (skip for manual syncs)
	if reason != "manual" {
		jitter := time.Duration(rand.Intn(int(s.config.JitterMax.Seconds()))) * time.Second
		time.Sleep(jitter)
	}

	// Check if update is needed (Lightweight HEAD request or Meta check)
	// For simplicity, we just fetch fresh data and compare
	var freshItems []RoadmapItem
	var err error

	s.mu.RLock()
	useCDN := s.useCDN
	s.mu.RUnlock()

	if useCDN {
		// CDN defines its own concurrency and update check inside FetchRoadmap
		freshItems, err = s.fetchFromCDNSync(lang)
	} else {
		freshItems, err = s.fetchFromGitHubDirect()
	}

	if err != nil {
		// Log error but NEVER clear existing cache - keep last good snapshot
		s.handleSyncError(err, reason)
		return
	}

	// Success - reset backoff and update cache
	s.syncMu.Lock()
	s.syncState.LastSync = time.Now()
	s.syncState.LastError = nil
	s.syncState.ErrorCount = 0
	s.syncState.BackoffTime = 0
	s.syncMu.Unlock()

	// Compare with current cache
	s.mu.RLock()
	hasChanges := !itemsEqual(s.cache, freshItems)
	s.mu.RUnlock()

	if hasChanges {
		s.updateMemoryCache(freshItems, lang)

		// Log successful sync with reason
		logger.Log.Debug().
			Str("syncReason", reason).
			Int("items", len(freshItems)).
			Msg("roadmap synced successfully")

		// Emit event to frontend for live update
		if s.eventEmitter != nil {
			s.eventEmitter("roadmap:update", freshItems)
		}
	}
}

// fetchFromCDNSync handles the logic of calling cdnFetcher and checking ETag
func (s *Service) fetchFromCDNSync(lang string) ([]RoadmapItem, error) {
	// Check local hash vs remote meta (optional optimization, skipped for now to prefer ETag)

	s.mu.RLock()
	etag := s.lastETag
	s.mu.RUnlock()

	result, err := s.cdnFetcher.FetchRoadmap(etag, lang)
	if err != nil {
		logger.Log.Error().Err(err).Msg("CDN fetch failed")
		return nil, err
	}

	if result.Roadmap == nil {
		logger.Log.Warn().Msg("CDN returned empty roadmap")
		return []RoadmapItem{}, nil
	}

	items := ToRoadmapItems(result.Roadmap.Items)

	// Save to cache
	if s.cacheRepo != nil {
		if err := s.cacheRepo.Save(result.Roadmap, result.ContentHash, result.ETag); err != nil {
			logger.Log.Warn().Err(err).Msg("failed to persist roadmap cache")
		}
	}

	s.updateMemoryCache(items, lang)
	return items, nil
}

// handleSyncError implements exponential backoff
// IMPORTANT: Never clears cache on error - always keep last good snapshot
func (s *Service) handleSyncError(err error, syncReason string) {
	s.syncMu.Lock()
	defer s.syncMu.Unlock()

	s.syncState.LastError = err
	s.syncState.ErrorCount++

	// Calculate exponential backoff: 1s → 2s → 4s → 8s → ... → 60s max
	backoff := s.config.InitialBackoff * time.Duration(1<<uint(s.syncState.ErrorCount-1))
	if backoff > s.config.MaxBackoff {
		backoff = s.config.MaxBackoff
	}
	s.syncState.BackoffTime = backoff

	// Log with structured fields (no sensitive data)
	logger.Log.Warn().
		Str("syncReason", syncReason).
		Int("attempt", s.syncState.ErrorCount).
		Str("backoff", backoff.String()).
		Str("error", err.Error()). // Only error message, not full stack
		Msg("roadmap sync failed, using cached data")
}

// StartPeriodicSync starts background sync at configured interval
func (s *Service) StartPeriodicSync(ctx context.Context) {
	s.ctx = ctx

	// Create cancellable context for sync loop
	syncCtx, cancel := context.WithCancel(ctx)
	s.cancelSync = cancel

	go func() {
		ticker := time.NewTicker(s.config.SyncInterval)
		defer ticker.Stop()

		for {
			select {
			case <-syncCtx.Done():
				return
			case <-ticker.C:
				s.syncInBackground("timer", "")
			}
		}
	}()
}

// StopPeriodicSync stops the background sync loop
func (s *Service) StopPeriodicSync() {
	if s.cancelSync != nil {
		s.cancelSync()
	}
}

// fetchFromGitHubDirect executes the GraphQL query to fetch project items directly
// This is the fallback when CDN is not available or not deployed
func (s *Service) fetchFromGitHubDirect() ([]RoadmapItem, error) {
	var token string
	if s.tokenProvider != nil {
		token = s.tokenProvider()
	}

	if token == "" {
		return []RoadmapItem{}, nil
	}

	items, err := s.fetchFromProjects(token)
	if err != nil {
		return nil, err
	}

	s.updateMemoryCache(items, "") // GitHub direct has no language context
	return items, nil
}

// fetchFromProjects executes the GraphQL query to fetch project items
func (s *Service) fetchFromProjects(token string) ([]RoadmapItem, error) {
	const query = `
	query($login: String!, $number: Int!) {
		organization(login: $login) {
			projectV2(number: $number) {
				items(first: 100) {
					nodes {
						content {
							... on Issue {
								number
								title
								body
								url
								comments { totalCount }
								reactions(content: THUMBS_UP) { totalCount }
								labels(first: 10) { nodes { name } }
								author { login, avatarUrl }
								createdAt
							}
						}
						fieldValueByName(name: "Status") {
							... on ProjectV2ItemFieldSingleSelectValue { name }
						}
					}
				}
			}
		}
	}`

	payload := map[string]interface{}{
		"query": query,
		"variables": map[string]interface{}{
			"login":  s.repoOwner,
			"number": s.projectNumber,
		},
	}

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal query failed: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.github.com/graphql", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "DownKingo-Desktop/1.0")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("api request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("api error: status %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			Organization struct {
				ProjectV2 struct {
					Items struct {
						Nodes []struct {
							Content struct {
								Number    int    `json:"number"`
								Title     string `json:"title"`
								Body      string `json:"body"`
								URL       string `json:"url"`
								Comments  struct{ TotalCount int }
								Reactions struct{ TotalCount int }
								Labels    struct{ Nodes []struct{ Name string } }
								Author    struct{ Login, AvatarUrl string }
								CreatedAt string
							}
							FieldValueByName *struct {
								Name string
							}
						}
					}
				}
			}
		}
		Errors []struct{ Message string }
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response failed: %w", err)
	}

	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("graphql error: %s", result.Errors[0].Message)
	}

	nodes := result.Data.Organization.ProjectV2.Items.Nodes
	if nodes == nil {
		return nil, fmt.Errorf("project #%d not found in organization '%s'", s.projectNumber, s.repoOwner)
	}

	items := make([]RoadmapItem, 0, len(nodes))
	for _, node := range nodes {
		content := node.Content
		if content.Number == 0 {
			continue // Skip draft items or non-issues
		}

		status := StatusIdeia
		if node.FieldValueByName != nil && node.FieldValueByName.Name != "" {
			slug := strings.ToLower(node.FieldValueByName.Name)
			if s, ok := statusMapping[slug]; ok {
				status = s
			}
		}

		labels := make([]string, 0, len(content.Labels.Nodes))
		for _, l := range content.Labels.Nodes {
			labels = append(labels, l.Name)
		}

		items = append(items, RoadmapItem{
			ID:           content.Number,
			Title:        content.Title,
			Description:  content.Body,
			Status:       status,
			Votes:        content.Reactions.TotalCount,
			VotesUp:      content.Reactions.TotalCount,
			Comments:     content.Comments.TotalCount,
			URL:          content.URL,
			Labels:       labels,
			Author:       content.Author.Login,
			AuthorAvatar: content.Author.AvatarUrl,
			CreatedAt:    parseDate(content.CreatedAt),
		})
	}

	sortItems(items)
	return items, nil
}

// VoteOnIssue adds a thumbs-up reaction to an issue (direct GitHub API)
func (s *Service) VoteOnIssue(token string, issueID int) error {
	return s.addReaction(token, issueID, "+1")
}

// VoteDownOnIssue adds a thumbs-down reaction to an issue (direct GitHub API)
func (s *Service) VoteDownOnIssue(token string, issueID int) error {
	return s.addReaction(token, issueID, "-1")
}

// addReaction is a helper that adds a reaction to an issue
func (s *Service) addReaction(token string, issueID int, reaction string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d/reactions", s.repoOwner, s.repoName, issueID)
	body := map[string]string{"content": reaction}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.squirrel-girl-preview+json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return fmt.Errorf("reaction failed: status %d", resp.StatusCode)
	}

	s.invalidateCache()
	return nil
}

// CreateIssue creates a new issue with 'enhancement' and 'suggestion' labels (direct GitHub API)
func (s *Service) CreateIssue(token, title, body string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues", s.repoOwner, s.repoName)
	payload := map[string]interface{}{
		"title":  title,
		"body":   body,
		"labels": []string{"enhancement", "suggestion"},
	}
	jsonBody, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 {
		return fmt.Errorf("create issue failed: status %d", resp.StatusCode)
	}

	s.invalidateCache()
	return nil
}

// Helper functions

func (s *Service) invalidateCache() {
	s.mu.Lock()
	s.lastFetch = time.Time{}
	s.mu.Unlock()
}

func parseDate(dateStr string) string {
	if dateStr == "" {
		return ""
	}
	t, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		return ""
	}
	return t.Format("2006-01-02")
}

func sortItems(items []RoadmapItem) {
	sort.Slice(items, func(i, j int) bool {
		// Shipped items go to bottom by ID
		if items[i].Status == StatusShipped && items[j].Status == StatusShipped {
			return items[i].ID > items[j].ID
		}
		// Others sorted by votes
		return items[i].Votes > items[j].Votes
	})
}

// itemsEqual compares two slices of RoadmapItems for equality
func itemsEqual(a, b []RoadmapItem) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].ID != b[i].ID || a[i].Title != b[i].Title || a[i].Votes != b[i].Votes {
			return false
		}
	}
	return true
}

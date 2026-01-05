// Package ratelimit provides rate limiting utilities to protect against abuse.
// Uses a token bucket algorithm for smooth rate limiting.
package ratelimit

import (
	"sync"
	"time"
)

// Limiter implements a token bucket rate limiter.
// It's safe for concurrent use.
type Limiter struct {
	mu           sync.Mutex
	tokens       float64
	maxTokens    float64
	refillRate   float64 // tokens per second
	lastRefill   time.Time
	requestCount int64
}

// NewLimiter creates a new rate limiter.
// maxTokens: maximum burst size
// refillRate: tokens replenished per second
func NewLimiter(maxTokens float64, refillRate float64) *Limiter {
	return &Limiter{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// Allow checks if an action is allowed and consumes a token if so.
// Returns true if the action is allowed, false if rate limited.
func (l *Limiter) Allow() bool {
	return l.AllowN(1)
}

// AllowN checks if n actions are allowed and consumes n tokens if so.
func (l *Limiter) AllowN(n float64) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.refill()

	if l.tokens >= n {
		l.tokens -= n
		l.requestCount++
		return true
	}

	return false
}

// refill adds tokens based on elapsed time.
func (l *Limiter) refill() {
	now := time.Now()
	elapsed := now.Sub(l.lastRefill).Seconds()
	l.tokens += elapsed * l.refillRate

	if l.tokens > l.maxTokens {
		l.tokens = l.maxTokens
	}

	l.lastRefill = now
}

// Wait blocks until a token is available or the context is cancelled.
func (l *Limiter) Wait() {
	for !l.Allow() {
		time.Sleep(100 * time.Millisecond)
	}
}

// Reset resets the limiter to full tokens.
func (l *Limiter) Reset() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.tokens = l.maxTokens
	l.lastRefill = time.Now()
}

// Stats returns current limiter statistics.
func (l *Limiter) Stats() (tokens float64, requestCount int64) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.refill()
	return l.tokens, l.requestCount
}

// PerEndpointLimiter manages rate limits for multiple endpoints.
type PerEndpointLimiter struct {
	mu       sync.RWMutex
	limiters map[string]*Limiter
	config   LimiterConfig
}

// LimiterConfig defines rate limit configuration.
type LimiterConfig struct {
	MaxTokens  float64
	RefillRate float64
}

// DefaultConfig returns default rate limit configuration.
// Allows 10 requests with 2 refills per second (generous for desktop app).
func DefaultConfig() LimiterConfig {
	return LimiterConfig{
		MaxTokens:  10,
		RefillRate: 2,
	}
}

// StrictConfig returns strict rate limit configuration.
// For sensitive operations like downloads.
func StrictConfig() LimiterConfig {
	return LimiterConfig{
		MaxTokens:  5,
		RefillRate: 1,
	}
}

// NewPerEndpointLimiter creates a new per-endpoint rate limiter.
func NewPerEndpointLimiter(config LimiterConfig) *PerEndpointLimiter {
	return &PerEndpointLimiter{
		limiters: make(map[string]*Limiter),
		config:   config,
	}
}

// Allow checks if an action on the given endpoint is allowed.
func (p *PerEndpointLimiter) Allow(endpoint string) bool {
	p.mu.RLock()
	limiter, exists := p.limiters[endpoint]
	p.mu.RUnlock()

	if !exists {
		p.mu.Lock()
		// Double-check after acquiring write lock
		if limiter, exists = p.limiters[endpoint]; !exists {
			limiter = NewLimiter(p.config.MaxTokens, p.config.RefillRate)
			p.limiters[endpoint] = limiter
		}
		p.mu.Unlock()
	}

	return limiter.Allow()
}

// Global rate limiters for the application.
var (
	// VideoInfoLimiter limits video info requests (10 req, 2/sec)
	VideoInfoLimiter = NewLimiter(10, 2)

	// DownloadLimiter limits concurrent download requests (5 req, 1/sec)
	DownloadLimiter = NewLimiter(5, 1)

	// ImageDownloadLimiter limits image download requests (10 req, 3/sec)
	ImageDownloadLimiter = NewLimiter(10, 3)

	// InstagramLimiter limits Instagram API calls (5 req, 0.5/sec - Instagram is strict)
	InstagramLimiter = NewLimiter(5, 0.5)
)

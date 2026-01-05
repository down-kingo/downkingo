package ratelimit_test

import (
	"testing"
	"time"

	"kingo/internal/ratelimit"
)

func TestLimiter_Allow(t *testing.T) {
	// Create limiter with 3 tokens, 1 refill per second
	limiter := ratelimit.NewLimiter(3, 1)

	// Should allow first 3 requests
	for i := 0; i < 3; i++ {
		if !limiter.Allow() {
			t.Errorf("Request %d should be allowed", i+1)
		}
	}

	// 4th request should be denied (no tokens left)
	if limiter.Allow() {
		t.Error("4th request should be denied")
	}
}

func TestLimiter_Refill(t *testing.T) {
	// Create limiter with 1 token, 10 refills per second
	limiter := ratelimit.NewLimiter(1, 10)

	// Use the token
	if !limiter.Allow() {
		t.Error("First request should be allowed")
	}

	// Should be denied immediately
	if limiter.Allow() {
		t.Error("Second request should be denied immediately")
	}

	// Wait for refill (100ms should add ~1 token at 10/sec)
	time.Sleep(150 * time.Millisecond)

	// Should be allowed now
	if !limiter.Allow() {
		t.Error("Request after refill should be allowed")
	}
}

func TestLimiter_AllowN(t *testing.T) {
	limiter := ratelimit.NewLimiter(5, 1)

	// Request 3 tokens
	if !limiter.AllowN(3) {
		t.Error("Should allow 3 tokens")
	}

	// Request 3 more (only 2 left)
	if limiter.AllowN(3) {
		t.Error("Should deny - only 2 tokens left")
	}

	// Request 2 should work
	if !limiter.AllowN(2) {
		t.Error("Should allow remaining 2 tokens")
	}
}

func TestLimiter_Reset(t *testing.T) {
	limiter := ratelimit.NewLimiter(5, 1)

	// Use all tokens
	for i := 0; i < 5; i++ {
		limiter.Allow()
	}

	// Should be denied
	if limiter.Allow() {
		t.Error("Should be denied after using all tokens")
	}

	// Reset
	limiter.Reset()

	// Should be allowed again
	if !limiter.Allow() {
		t.Error("Should be allowed after reset")
	}
}

func TestLimiter_Stats(t *testing.T) {
	limiter := ratelimit.NewLimiter(10, 1)

	// Make 3 requests
	limiter.Allow()
	limiter.Allow()
	limiter.Allow()

	tokens, count := limiter.Stats()

	if count != 3 {
		t.Errorf("Request count = %d, want 3", count)
	}

	if tokens > 7.5 || tokens < 6.5 {
		t.Errorf("Tokens = %f, want ~7", tokens)
	}
}

func TestPerEndpointLimiter(t *testing.T) {
	config := ratelimit.LimiterConfig{
		MaxTokens:  2,
		RefillRate: 1,
	}
	limiter := ratelimit.NewPerEndpointLimiter(config)

	// Different endpoints should have separate limits
	if !limiter.Allow("youtube") {
		t.Error("First youtube request should be allowed")
	}
	if !limiter.Allow("youtube") {
		t.Error("Second youtube request should be allowed")
	}
	if limiter.Allow("youtube") {
		t.Error("Third youtube request should be denied")
	}

	// Instagram should have its own pool
	if !limiter.Allow("instagram") {
		t.Error("First instagram request should be allowed")
	}
}

func TestGlobalLimiters(t *testing.T) {
	// Just verify they exist and are usable
	if ratelimit.VideoInfoLimiter == nil {
		t.Error("VideoInfoLimiter should not be nil")
	}
	if ratelimit.DownloadLimiter == nil {
		t.Error("DownloadLimiter should not be nil")
	}
	if ratelimit.ImageDownloadLimiter == nil {
		t.Error("ImageDownloadLimiter should not be nil")
	}
	if ratelimit.InstagramLimiter == nil {
		t.Error("InstagramLimiter should not be nil")
	}
}

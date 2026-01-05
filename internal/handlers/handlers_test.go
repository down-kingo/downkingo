package handlers_test

import (
	"context"
	"errors"
	"testing"

	"kingo/internal/handlers"
	"kingo/internal/storage"
	"kingo/internal/youtube"
)

// =============================================================================
// MOCKS - Test doubles for unit testing
// =============================================================================

// MockYouTubeClient is a test double for the YouTube client.
type MockYouTubeClient struct {
	GetVideoInfoFunc func(ctx context.Context, url string) (*youtube.VideoInfo, error)
	DownloadFunc     func(ctx context.Context, opts youtube.DownloadOptions, onProgress youtube.ProgressCallback, onLog youtube.LogCallback) error
	UpdateYtDlpFunc  func(channel string) (string, error)
}

func (m *MockYouTubeClient) GetVideoInfo(ctx context.Context, url string) (*youtube.VideoInfo, error) {
	if m.GetVideoInfoFunc != nil {
		return m.GetVideoInfoFunc(ctx, url)
	}
	return &youtube.VideoInfo{Title: "Test Video", Duration: 120}, nil
}

func (m *MockYouTubeClient) Download(ctx context.Context, opts youtube.DownloadOptions, onProgress youtube.ProgressCallback, onLog youtube.LogCallback) error {
	if m.DownloadFunc != nil {
		return m.DownloadFunc(ctx, opts, onProgress, onLog)
	}
	return nil
}

func (m *MockYouTubeClient) UpdateYtDlp(channel string) (string, error) {
	if m.UpdateYtDlpFunc != nil {
		return m.UpdateYtDlpFunc(channel)
	}
	return "2024.01.01", nil
}

// MockDownloadManager is a test double for the download manager.
type MockDownloadManager struct {
	AddJobFunc       func(opts youtube.DownloadOptions) (*storage.Download, error)
	CancelJobFunc    func(id string) error
	GetQueueFunc     func() ([]*storage.Download, error)
	GetHistoryFunc   func(limit int) ([]*storage.Download, error)
	ClearHistoryFunc func() error
}

func (m *MockDownloadManager) AddJob(opts youtube.DownloadOptions) (*storage.Download, error) {
	if m.AddJobFunc != nil {
		return m.AddJobFunc(opts)
	}
	return &storage.Download{ID: "test-id", URL: opts.URL}, nil
}

func (m *MockDownloadManager) CancelJob(id string) error {
	if m.CancelJobFunc != nil {
		return m.CancelJobFunc(id)
	}
	return nil
}

func (m *MockDownloadManager) GetQueue() ([]*storage.Download, error) {
	if m.GetQueueFunc != nil {
		return m.GetQueueFunc()
	}
	return []*storage.Download{}, nil
}

func (m *MockDownloadManager) GetHistory(limit int) ([]*storage.Download, error) {
	if m.GetHistoryFunc != nil {
		return m.GetHistoryFunc(limit)
	}
	return []*storage.Download{}, nil
}

func (m *MockDownloadManager) ClearHistory() error {
	if m.ClearHistoryFunc != nil {
		return m.ClearHistoryFunc()
	}
	return nil
}

// =============================================================================
// TESTS - VideoHandler
// =============================================================================

func TestVideoHandler_GetVideoInfo(t *testing.T) {
	t.Run("rejects empty URL", func(t *testing.T) {
		mockYT := &MockYouTubeClient{}
		handler := handlers.NewVideoHandler(mockYT, nil)

		_, err := handler.GetVideoInfo("")
		if err == nil {
			t.Error("expected error for empty URL")
		}
	})

	t.Run("rejects invalid URL scheme", func(t *testing.T) {
		mockYT := &MockYouTubeClient{}
		handler := handlers.NewVideoHandler(mockYT, nil)

		_, err := handler.GetVideoInfo("ftp://example.com/video")
		if err == nil {
			t.Error("expected error for invalid URL scheme")
		}
	})

	t.Run("returns video info for valid URL", func(t *testing.T) {
		expectedTitle := "Test Video Title"
		mockYT := &MockYouTubeClient{
			GetVideoInfoFunc: func(ctx context.Context, url string) (*youtube.VideoInfo, error) {
				return &youtube.VideoInfo{Title: expectedTitle, Duration: 300}, nil
			},
		}
		handler := handlers.NewVideoHandler(mockYT, nil)

		info, err := handler.GetVideoInfo("https://youtube.com/watch?v=test123")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if info.Title != expectedTitle {
			t.Errorf("got title %q, want %q", info.Title, expectedTitle)
		}
	})

	t.Run("wraps YouTube client errors", func(t *testing.T) {
		mockYT := &MockYouTubeClient{
			GetVideoInfoFunc: func(ctx context.Context, url string) (*youtube.VideoInfo, error) {
				return nil, errors.New("video not found")
			},
		}
		handler := handlers.NewVideoHandler(mockYT, nil)

		_, err := handler.GetVideoInfo("https://youtube.com/watch?v=invalid")
		if err == nil {
			t.Error("expected error from YouTube client")
		}
	})

	t.Run("returns error when youtube client is nil", func(t *testing.T) {
		handler := handlers.NewVideoHandler(nil, nil)

		_, err := handler.GetVideoInfo("https://youtube.com/watch?v=test")
		if err == nil {
			t.Error("expected error when youtube client is nil")
		}
	})
}

func TestVideoHandler_AddToQueue(t *testing.T) {
	t.Run("rejects empty URL", func(t *testing.T) {
		mockDM := &MockDownloadManager{}
		handler := handlers.NewVideoHandler(nil, mockDM)

		_, err := handler.AddToQueue("", "best", false)
		if err == nil {
			t.Error("expected error for empty URL")
		}
	})

	t.Run("rejects invalid URL", func(t *testing.T) {
		mockDM := &MockDownloadManager{}
		handler := handlers.NewVideoHandler(nil, mockDM)

		_, err := handler.AddToQueue("not-a-url", "best", false)
		if err == nil {
			t.Error("expected error for invalid URL")
		}
	})

	t.Run("adds valid URL to queue", func(t *testing.T) {
		var capturedOpts youtube.DownloadOptions
		mockDM := &MockDownloadManager{
			AddJobFunc: func(opts youtube.DownloadOptions) (*storage.Download, error) {
				capturedOpts = opts
				return &storage.Download{ID: "job-123", URL: opts.URL}, nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		download, err := handler.AddToQueue("https://youtube.com/watch?v=test", "720p", false)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if download.ID != "job-123" {
			t.Errorf("got ID %q, want %q", download.ID, "job-123")
		}
		if capturedOpts.Format != "720p" {
			t.Errorf("got format %q, want %q", capturedOpts.Format, "720p")
		}
		if capturedOpts.AudioOnly != false {
			t.Error("expected AudioOnly to be false")
		}
	})

	t.Run("defaults empty format to best", func(t *testing.T) {
		var capturedFormat string
		mockDM := &MockDownloadManager{
			AddJobFunc: func(opts youtube.DownloadOptions) (*storage.Download, error) {
				capturedFormat = opts.Format
				return &storage.Download{ID: "test"}, nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		_, _ = handler.AddToQueue("https://youtube.com/watch?v=test", "", false)
		if capturedFormat != "best" {
			t.Errorf("got format %q, want %q", capturedFormat, "best")
		}
	})

	t.Run("passes audioOnly flag correctly", func(t *testing.T) {
		var capturedAudioOnly bool
		mockDM := &MockDownloadManager{
			AddJobFunc: func(opts youtube.DownloadOptions) (*storage.Download, error) {
				capturedAudioOnly = opts.AudioOnly
				return &storage.Download{ID: "test"}, nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		_, _ = handler.AddToQueue("https://youtube.com/watch?v=test", "best", true)
		if capturedAudioOnly != true {
			t.Error("expected AudioOnly to be true")
		}
	})

	t.Run("returns error when download manager is nil", func(t *testing.T) {
		handler := handlers.NewVideoHandler(nil, nil)

		_, err := handler.AddToQueue("https://youtube.com/watch?v=test", "best", false)
		if err == nil {
			t.Error("expected error when download manager is nil")
		}
	})
}

func TestVideoHandler_GetDownloadHistory(t *testing.T) {
	t.Run("sanitizes negative limit to default", func(t *testing.T) {
		var capturedLimit int
		mockDM := &MockDownloadManager{
			GetHistoryFunc: func(limit int) ([]*storage.Download, error) {
				capturedLimit = limit
				return []*storage.Download{}, nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		_, _ = handler.GetDownloadHistory(-10)
		if capturedLimit != 50 {
			t.Errorf("got limit %d, want 50 (default)", capturedLimit)
		}
	})

	t.Run("caps excessive limit at 500", func(t *testing.T) {
		var capturedLimit int
		mockDM := &MockDownloadManager{
			GetHistoryFunc: func(limit int) ([]*storage.Download, error) {
				capturedLimit = limit
				return []*storage.Download{}, nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		_, _ = handler.GetDownloadHistory(1000)
		if capturedLimit != 500 {
			t.Errorf("got limit %d, want 500 (max)", capturedLimit)
		}
	})

	t.Run("passes valid limit through", func(t *testing.T) {
		var capturedLimit int
		mockDM := &MockDownloadManager{
			GetHistoryFunc: func(limit int) ([]*storage.Download, error) {
				capturedLimit = limit
				return []*storage.Download{}, nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		_, _ = handler.GetDownloadHistory(25)
		if capturedLimit != 25 {
			t.Errorf("got limit %d, want 25", capturedLimit)
		}
	})
}

func TestVideoHandler_CancelDownload(t *testing.T) {
	t.Run("rejects empty ID", func(t *testing.T) {
		mockDM := &MockDownloadManager{}
		handler := handlers.NewVideoHandler(nil, mockDM)

		err := handler.CancelDownload("")
		if err == nil {
			t.Error("expected error for empty ID")
		}
	})

	t.Run("rejects whitespace-only ID", func(t *testing.T) {
		mockDM := &MockDownloadManager{}
		handler := handlers.NewVideoHandler(nil, mockDM)

		err := handler.CancelDownload("   ")
		if err == nil {
			t.Error("expected error for whitespace-only ID")
		}
	})

	t.Run("calls CancelJob with trimmed ID", func(t *testing.T) {
		var capturedID string
		mockDM := &MockDownloadManager{
			CancelJobFunc: func(id string) error {
				capturedID = id
				return nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		err := handler.CancelDownload("  job-123  ")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if capturedID != "job-123" {
			t.Errorf("got ID %q, want %q", capturedID, "job-123")
		}
	})

	t.Run("propagates cancel errors", func(t *testing.T) {
		mockDM := &MockDownloadManager{
			CancelJobFunc: func(id string) error {
				return errors.New("job not found")
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		err := handler.CancelDownload("invalid-id")
		if err == nil {
			t.Error("expected error from CancelJob")
		}
	})
}

func TestVideoHandler_UpdateYtDlp(t *testing.T) {
	t.Run("sanitizes invalid channel to stable", func(t *testing.T) {
		var capturedChannel string
		mockYT := &MockYouTubeClient{
			UpdateYtDlpFunc: func(channel string) (string, error) {
				capturedChannel = channel
				return "2024.01.01", nil
			},
		}
		handler := handlers.NewVideoHandler(mockYT, nil)

		_, _ = handler.UpdateYtDlp("malicious-channel")
		if capturedChannel != "stable" {
			t.Errorf("got channel %q, want %q", capturedChannel, "stable")
		}
	})

	t.Run("allows valid channels", func(t *testing.T) {
		validChannels := []string{"stable", "nightly", "master"}

		for _, channel := range validChannels {
			t.Run(channel, func(t *testing.T) {
				var capturedChannel string
				mockYT := &MockYouTubeClient{
					UpdateYtDlpFunc: func(ch string) (string, error) {
						capturedChannel = ch
						return "2024.01.01", nil
					},
				}
				handler := handlers.NewVideoHandler(mockYT, nil)

				_, _ = handler.UpdateYtDlp(channel)
				if capturedChannel != channel {
					t.Errorf("got channel %q, want %q", capturedChannel, channel)
				}
			})
		}
	})

	t.Run("defaults empty channel to stable", func(t *testing.T) {
		var capturedChannel string
		mockYT := &MockYouTubeClient{
			UpdateYtDlpFunc: func(channel string) (string, error) {
				capturedChannel = channel
				return "2024.01.01", nil
			},
		}
		handler := handlers.NewVideoHandler(mockYT, nil)

		_, _ = handler.UpdateYtDlp("")
		if capturedChannel != "stable" {
			t.Errorf("got channel %q, want %q", capturedChannel, "stable")
		}
	})
}

func TestVideoHandler_AddToQueueAdvanced(t *testing.T) {
	t.Run("defaults audio format to mp3 when audioOnly", func(t *testing.T) {
		var capturedFormat string
		mockDM := &MockDownloadManager{
			AddJobFunc: func(opts youtube.DownloadOptions) (*storage.Download, error) {
				capturedFormat = opts.AudioFormat
				return &storage.Download{ID: "test"}, nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		opts := youtube.DownloadOptions{
			URL:         "https://youtube.com/watch?v=test",
			AudioOnly:   true,
			AudioFormat: "", // Empty should default to mp3
		}
		_, _ = handler.AddToQueueAdvanced(opts)

		if capturedFormat != "mp3" {
			t.Errorf("got audio format %q, want %q", capturedFormat, "mp3")
		}
	})

	t.Run("caps aria2c connections at 32", func(t *testing.T) {
		var capturedConnections int
		mockDM := &MockDownloadManager{
			AddJobFunc: func(opts youtube.DownloadOptions) (*storage.Download, error) {
				capturedConnections = opts.Aria2cConnections
				return &storage.Download{ID: "test"}, nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		opts := youtube.DownloadOptions{
			URL:               "https://youtube.com/watch?v=test",
			Aria2cConnections: 100, // Should be capped at 32 (or reset to 16)
		}
		_, _ = handler.AddToQueueAdvanced(opts)

		if capturedConnections > 32 {
			t.Errorf("got aria2c connections %d, want <= 32", capturedConnections)
		}
	})

	t.Run("resets negative aria2c connections to 16", func(t *testing.T) {
		var capturedConnections int
		mockDM := &MockDownloadManager{
			AddJobFunc: func(opts youtube.DownloadOptions) (*storage.Download, error) {
				capturedConnections = opts.Aria2cConnections
				return &storage.Download{ID: "test"}, nil
			},
		}
		handler := handlers.NewVideoHandler(nil, mockDM)

		opts := youtube.DownloadOptions{
			URL:               "https://youtube.com/watch?v=test",
			Aria2cConnections: -5,
		}
		_, _ = handler.AddToQueueAdvanced(opts)

		if capturedConnections != 16 {
			t.Errorf("got aria2c connections %d, want 16 (default)", capturedConnections)
		}
	})
}

// =============================================================================
// CONSOLE EMITTER TESTS
// =============================================================================

func TestVideoHandler_ConsoleEmitter(t *testing.T) {
	t.Run("emits console messages", func(t *testing.T) {
		var capturedMessages []string
		mockYT := &MockYouTubeClient{
			GetVideoInfoFunc: func(ctx context.Context, url string) (*youtube.VideoInfo, error) {
				return &youtube.VideoInfo{Title: "Test"}, nil
			},
		}
		handler := handlers.NewVideoHandler(mockYT, nil)
		handler.SetConsoleEmitter(func(msg string) {
			capturedMessages = append(capturedMessages, msg)
		})

		_, _ = handler.GetVideoInfo("https://youtube.com/watch?v=test")

		if len(capturedMessages) == 0 {
			t.Error("expected console messages to be emitted")
		}
	})
}

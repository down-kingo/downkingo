package handlers

import (
	"context"
	"errors"
	"strings"
	"testing"

	apperr "kingo/internal/errors"
	"kingo/internal/youtube"
)

type fakeMediaExtractor struct {
	publicErr       error
	authenticated   []youtube.VideoInfo
	receivedURL     string
	receivedBrowser string
}

func (f *fakeMediaExtractor) GetPlaylistInfo(_ context.Context, url string) ([]youtube.VideoInfo, error) {
	f.receivedURL = url
	return nil, f.publicErr
}

func (f *fakeMediaExtractor) GetPlaylistInfoWithCookies(_ context.Context, url, browser string) ([]youtube.VideoInfo, error) {
	f.receivedURL = url
	f.receivedBrowser = browser
	items := append([]youtube.VideoInfo(nil), f.authenticated...)
	for index := range items {
		items[index].CookieBrowser = browser
	}
	return items, nil
}

func (f *fakeMediaExtractor) GetVideoInfo(context.Context, string) (*youtube.VideoInfo, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeMediaExtractor) GetVideoInfoWithCookies(context.Context, string, string) (*youtube.VideoInfo, error) {
	return nil, errors.New("not implemented")
}

func TestCarouselMediaType(t *testing.T) {
	tests := []struct {
		name     string
		info     youtube.VideoInfo
		url      string
		expected string
	}{
		{name: "image thumbnail", url: "https://cdn.example/photo.webp", expected: "image"},
		{name: "duration", info: youtube.VideoInfo{Duration: 3}, url: "https://cdn.example/media", expected: "video"},
		{name: "formats", info: youtube.VideoInfo{Formats: []youtube.Format{{URL: "https://cdn.example/media"}}}, expected: "video"},
		{name: "mp4 URL", url: "https://cdn.example/media.mp4?token=1", expected: "video"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := carouselMediaType(test.info, test.url); actual != test.expected {
				t.Fatalf("expected %s, got %s", test.expected, actual)
			}
		})
	}
}

func TestInstagramStoryRequestsBrowserAuthentication(t *testing.T) {
	extractor := &fakeMediaExtractor{
		publicErr: errors.New("You need to log in. Use --cookies-from-browser"),
	}
	handler := NewMediaHandler(nil, extractor)
	storyURL := "https://www.instagram.com/stories/neymarjr/"

	_, err := handler.GetInstagramCarousel(storyURL)
	if !errors.Is(err, apperr.ErrAuthRequired) {
		t.Fatalf("expected auth-required error, got %v", err)
	}
	if !strings.Contains(err.Error(), "Stories") {
		t.Fatalf("expected Story-specific error, got %v", err)
	}
	if extractor.receivedURL != storyURL {
		t.Fatalf("story URL was not sent to yt-dlp: %q", extractor.receivedURL)
	}
}

func TestInstagramStoryUsesSelectedBrowserAndPropagatesItToVideos(t *testing.T) {
	extractor := &fakeMediaExtractor{
		authenticated: []youtube.VideoInfo{
			{
				URL:       "https://scontent.cdninstagram.com/story.jpg?token=1",
				Thumbnail: "https://scontent.cdninstagram.com/story.jpg?token=1",
				Width:     1080,
				Height:    1920,
			},
			{
				URL:      "https://scontent.cdninstagram.com/story.mp4?token=2",
				Duration: 8,
				Width:    1080,
				Height:   1920,
			},
		},
	}
	handler := NewMediaHandler(nil, extractor)
	storyURL := "https://www.instagram.com/stories/neymarjr/"

	result, err := handler.GetInstagramCarouselWithCookies(storyURL, "BRAVE")
	if err != nil {
		t.Fatalf("authenticated Story extraction failed: %v", err)
	}
	if extractor.receivedBrowser != "brave" {
		t.Fatalf("selected browser was not normalized: %q", extractor.receivedBrowser)
	}
	if len(result.MediaItems) != 2 {
		t.Fatalf("expected two Story items, got %d", len(result.MediaItems))
	}
	if result.MediaItems[0].Type != "image" || result.MediaItems[1].Type != "video" {
		t.Fatalf("unexpected Story media types: %#v", result.MediaItems)
	}
	for _, item := range result.MediaItems {
		if item.CookieBrowser != "brave" {
			t.Fatalf("browser was not propagated to Story item: %#v", item)
		}
	}
}

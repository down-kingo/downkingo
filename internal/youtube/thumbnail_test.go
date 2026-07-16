package youtube

import "testing"

func TestPreferBestThumbnailSelectsInstagramOriginal(t *testing.T) {
	preview := "https://instagram.example/image.webp?stp=dst-webp_s640x640"
	original := "https://instagram.example/image.webp?quality=original"
	info := VideoInfo{
		Thumbnail: preview,
		Thumbnails: []Thumbnail{
			{URL: original},
			{URL: "https://instagram.example/image.webp?stp=dst-webp_s1080x1080"},
			{URL: preview},
		},
	}

	info.PreferBestThumbnail()

	if info.Thumbnail != original {
		t.Fatalf("expected original thumbnail, got %q", info.Thumbnail)
	}
}

func TestPreferBestThumbnailUsesLargestDimensions(t *testing.T) {
	info := VideoInfo{
		Thumbnail: "https://example.com/small.jpg",
		Thumbnails: []Thumbnail{
			{URL: "https://example.com/small.jpg", Width: 320, Height: 180},
			{URL: "https://example.com/large.jpg", Width: 1920, Height: 1080},
		},
	}

	info.PreferBestThumbnail()

	if info.Thumbnail != "https://example.com/large.jpg" {
		t.Fatalf("expected largest thumbnail, got %q", info.Thumbnail)
	}
}

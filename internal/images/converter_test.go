package images

import "testing"

func TestConvertOriginalWithoutResizeIsNoOp(t *testing.T) {
	path, err := Convert("photo.webp", "original", 100, 100, "ffmpeg", "avifenc")
	if err != nil {
		t.Fatalf("original conversion failed: %v", err)
	}
	if path != "photo.webp" {
		t.Fatalf("expected original path, got %q", path)
	}
}

func TestConvertRejectsInvalidOptions(t *testing.T) {
	if _, err := Convert("photo.webp", "exe", 100, 100, "ffmpeg", "avifenc"); err == nil {
		t.Fatal("expected unsupported format to fail")
	}
	if _, err := Convert("photo.webp", "webp", 100, 500, "ffmpeg", "avifenc"); err == nil {
		t.Fatal("expected out-of-range scale to fail")
	}
}

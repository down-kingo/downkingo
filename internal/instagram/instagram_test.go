package instagram

import "testing"

func TestIsStoryURL(t *testing.T) {
	tests := []struct {
		url  string
		want bool
	}{
		{url: "https://www.instagram.com/stories/neymarjr/", want: true},
		{url: "https://instagram.com/stories/neymarjr/123456789/", want: true},
		{url: "https://www.instagram.com/p/ABC123/", want: false},
		{url: "https://www.instagram.com/reel/ABC123/", want: false},
		{url: "https://example.com/instagram.com/stories/neymarjr/", want: false},
	}

	for _, test := range tests {
		if got := IsStoryURL(test.url); got != test.want {
			t.Errorf("IsStoryURL(%q) = %v, want %v", test.url, got, test.want)
		}
	}
}

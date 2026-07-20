package updater

import "testing"

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"3.1.9", "3.1.10", -1}, // bug original: string comparison dizia 9 > 10
		{"3.1.10", "3.1.9", 1},
		{"3.1.1", "3.1.1", 0},
		{"1.0.0", "2.0.0", -1},
		{"2.1.0", "2.0.1", 1},
		{"1.0", "1.0.0", 0},
		{"1.0.0", "1.0", 0},
		{"0.9.9", "1.0.0", -1},
		{"10.0.0", "9.9.9", 1},
		{"3.1.10", "3.1.10", 0},
	}

	for _, tt := range tests {
		got := compareVersions(tt.a, tt.b)
		if got != tt.want {
			t.Errorf("compareVersions(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestSelectAssetForOS(t *testing.T) {
	assets := []Asset{
		{Name: "checksums.txt", BrowserDownloadURL: "checksums"},
		{Name: "DownKingo.exe", BrowserDownloadURL: "installer", Size: 123},
		{Name: "DownKingo-windows-portable.exe", BrowserDownloadURL: "portable"},
	}

	asset, ok := selectAssetForOS(assets, "windows")
	if !ok {
		t.Fatal("expected a compatible Windows installer")
	}
	if asset.BrowserDownloadURL != "installer" {
		t.Fatalf("selected %q, want the official DownKingo.exe installer", asset.Name)
	}
}

func TestSelectAssetForOSRejectsUnrelatedWindowsExecutable(t *testing.T) {
	assets := []Asset{{Name: "helper-windows.exe", BrowserDownloadURL: "helper"}}
	if _, ok := selectAssetForOS(assets, "windows"); ok {
		t.Fatal("an unrelated Windows executable must not be selected as an update")
	}
}

func TestTrustedUpdateURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want bool
	}{
		{
			name: "official release asset",
			url:  "https://github.com/down-kingo/downkingo/releases/download/v3.1.1/DownKingo.exe",
			want: true,
		},
		{name: "wrong repository", url: "https://github.com/attacker/downkingo/releases/download/v3.1.1/DownKingo.exe"},
		{name: "wrong host", url: "https://example.com/down-kingo/downkingo/releases/download/v3.1.1/DownKingo.exe"},
		{name: "insecure scheme", url: "http://github.com/down-kingo/downkingo/releases/download/v3.1.1/DownKingo.exe"},
		{name: "lookalike host", url: "https://github.com.evil.test/down-kingo/downkingo/releases/download/v3.1.1/DownKingo.exe"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isTrustedUpdateURL(tt.url); got != tt.want {
				t.Fatalf("isTrustedUpdateURL(%q) = %v, want %v", tt.url, got, tt.want)
			}
		})
	}
}

package updater

import "testing"

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"3.0.9", "3.0.10", -1},   // bug original: string comparison dizia 9 > 10
		{"3.0.10", "3.0.9", 1},
		{"3.0.0", "3.0.0", 0},
		{"1.0.0", "2.0.0", -1},
		{"2.1.0", "2.0.1", 1},
		{"1.0", "1.0.0", 0},
		{"1.0.0", "1.0", 0},
		{"0.9.9", "1.0.0", -1},
		{"10.0.0", "9.9.9", 1},
		{"3.0.10", "3.0.10", 0},
	}

	for _, tt := range tests {
		got := compareVersions(tt.a, tt.b)
		if got != tt.want {
			t.Errorf("compareVersions(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}

package aria2

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateRejectsMissingAndCorruptExecutables(t *testing.T) {
	if _, err := Validate(filepath.Join(t.TempDir(), "missing.exe")); err == nil {
		t.Fatal("missing aria2c was accepted")
	}
	path := filepath.Join(t.TempDir(), "aria2c.exe")
	if err := os.WriteFile(path, []byte("not aria2c"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Validate(path); err == nil {
		t.Fatal("corrupt aria2c was accepted")
	}
}

// Package aria2 defines and validates the aria2c runtime supported by DownKingo.
package aria2

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"
)

const (
	SupportedVersion = "1.37.0"
	ArchiveURL       = "https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip"
	ArchiveSHA256    = "67d015301eef0b612191212d564c5bb0a14b5b9c4796b76454276a4d28d9b288"
	ExecutableSHA256 = "be2099c214f63a3cb4954b09a0becd6e2e34660b886d4c898d260febfe9d70c2"
	ExecutableSize   = int64(5649408)
)

var versionPattern = regexp.MustCompile(`(?m)^aria2 version (\d+\.\d+\.\d+)\s*$`)

// Validate checks the executable identity, integrity and runtime version.
func Validate(path string) (string, error) {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() || info.Size() == 0 {
		return "", fmt.Errorf("aria2c executable is missing or has an unexpected size")
	}
	if runtime.GOOS == "windows" {
		if info.Size() != ExecutableSize {
			return "", fmt.Errorf("aria2c executable has an unexpected size")
		}
		file, err := os.Open(path)
		if err != nil {
			return "", err
		}
		hash := sha256.New()
		_, copyErr := io.Copy(hash, file)
		closeErr := file.Close()
		if copyErr != nil {
			return "", copyErr
		}
		if closeErr != nil {
			return "", closeErr
		}
		actualHash := hex.EncodeToString(hash.Sum(nil))
		if !strings.EqualFold(actualHash, ExecutableSHA256) {
			return "", fmt.Errorf("aria2c checksum mismatch: got %s", actualHash)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, path, "--version")
	hideWindow(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("aria2c could not execute: %w", err)
	}
	match := versionPattern.FindStringSubmatch(strings.ReplaceAll(string(output), "\r\n", "\n"))
	if len(match) != 2 {
		return "", fmt.Errorf("aria2c returned an unrecognized version")
	}
	if match[1] != SupportedVersion {
		return match[1], fmt.Errorf("unsupported aria2c version %s (expected %s)", match[1], SupportedVersion)
	}
	return match[1], nil
}

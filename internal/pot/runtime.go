// Package pot manages the pinned YouTube PO Token Provider used by yt-dlp.
package pot

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

const (
	SupportedVersion = "0.8.1"

	ProviderDependencyName = "YouTube PO Provider"
	PluginDependencyName   = "yt-dlp PO Plugin"
	PluginFileName         = "bgutil-ytdlp-pot-provider-rs.zip"
	ProjectURL             = "https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs"
	License                = "GPL-3.0"

	pluginURL    = ProjectURL + "/releases/download/v" + SupportedVersion + "/" + PluginFileName
	pluginSHA256 = "99fd83b98fa93b193d6a3b69dc74410d76e7a2b889868c54d16121cac9060344"
	pluginSize   = int64(6253)
)

// Asset describes a release artifact whose identity is pinned by SHA-256.
type Asset struct {
	URL        string
	SHA256     string
	RemoteName string
	LocalName  string
	Size       int64
}

// BinaryAsset returns the provider binary published for the current platform.
func BinaryAsset() (Asset, error) {
	baseURL := ProjectURL + "/releases/download/v" + SupportedVersion + "/"
	var asset Asset
	switch runtime.GOOS + "/" + runtime.GOARCH {
	case "windows/amd64":
		asset = Asset{
			RemoteName: "bgutil-pot-windows-x86_64.exe",
			LocalName:  "bgutil-pot.exe",
			SHA256:     "25d6b05c79176aa792454c3d1727922ca47e56cf11cb1e866615d751819b14a0",
			Size:       45795328,
		}
	case "linux/amd64":
		asset = Asset{
			RemoteName: "bgutil-pot-linux-x86_64",
			LocalName:  "bgutil-pot",
			SHA256:     "e7c264a574fa2705b6e5dc62283a8a4e80130f27b9d7e9df44e6b09aa6151a87",
			Size:       50990856,
		}
	case "linux/arm64":
		asset = Asset{
			RemoteName: "bgutil-pot-linux-aarch64",
			LocalName:  "bgutil-pot",
			SHA256:     "4f4a1f681dba45e695e1c14d314517da180a1fd374afd09d634fd80ef6d0284b",
			Size:       54147304,
		}
	case "darwin/amd64":
		asset = Asset{
			RemoteName: "bgutil-pot-macos-x86_64",
			LocalName:  "bgutil-pot",
			SHA256:     "0391175fa938c7fabbb8b40a40bd43182ef75af97e1dd3fab56eb23b4ac3e113",
			Size:       46407960,
		}
	case "darwin/arm64":
		asset = Asset{
			RemoteName: "bgutil-pot-macos-aarch64",
			LocalName:  "bgutil-pot",
			SHA256:     "34b83baf0a557fecaa6d67a8177e53e169c2ccf987182883a4bae289a7176883",
			Size:       43353024,
		}
	default:
		return Asset{}, fmt.Errorf("YouTube PO Provider is not available for %s/%s", runtime.GOOS, runtime.GOARCH)
	}
	asset.URL = baseURL + asset.RemoteName
	return asset, nil
}

// PluginAsset returns the matching yt-dlp provider plugin.
func PluginAsset() Asset {
	return Asset{
		URL:        pluginURL,
		SHA256:     pluginSHA256,
		RemoteName: PluginFileName,
		LocalName:  PluginFileName,
		Size:       pluginSize,
	}
}

// ValidateBinary verifies the pinned artifact and its reported version.
func ValidateBinary(path string) (string, error) {
	asset, err := BinaryAsset()
	if err != nil {
		return "", err
	}
	if err := validateFile(path, asset.Size, asset.SHA256); err != nil {
		return "", fmt.Errorf("invalid PO provider binary: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, path, "--version")
	hideWindow(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("PO provider could not execute: %w", err)
	}
	version := strings.TrimSpace(strings.TrimPrefix(string(output), "bgutil-pot "))
	if version != SupportedVersion {
		return version, fmt.Errorf("unsupported PO provider version %q (expected %s)", version, SupportedVersion)
	}
	return version, nil
}

// ValidatePlugin verifies the exact plugin archive paired with the binary.
func ValidatePlugin(path string) error {
	asset := PluginAsset()
	if err := validateFile(path, asset.Size, asset.SHA256); err != nil {
		return fmt.Errorf("invalid yt-dlp PO plugin: %w", err)
	}
	return nil
}

func validateFile(path string, expectedSize int64, expectedSHA256 string) error {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return fmt.Errorf("file is missing")
	}
	if info.Size() != expectedSize {
		return fmt.Errorf("unexpected size %d", info.Size())
	}
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	hash := sha256.New()
	_, copyErr := io.Copy(hash, file)
	closeErr := file.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	actual := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(actual, expectedSHA256) {
		return fmt.Errorf("checksum mismatch: got %s", actual)
	}
	return nil
}

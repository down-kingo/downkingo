package whisper

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"kingo/internal/logger"
)

const SupportedWhisperVersion = "1.9.1"

type runtimeAsset struct {
	URL        string
	SHA256     string
	BinaryName string
	Required   []string
}

var versionPattern = regexp.MustCompile(`\b(\d+\.\d+\.\d+)\b`)

func supportedRuntimeAsset() (runtimeAsset, error) {
	if runtime.GOOS != "windows" {
		return runtimeAsset{}, fmt.Errorf("automatic whisper installation is not available for %s", runtime.GOOS)
	}

	asset := runtimeAsset{
		BinaryName: "whisper-cli.exe",
		Required: []string{
			"whisper-cli.exe", "whisper.dll", "ggml.dll", "ggml-base.dll", "SDL2.dll",
		},
	}
	if runtime.GOARCH == "386" {
		asset.URL = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-Win32.zip"
		asset.SHA256 = "be1ea26c9665f1165a2f3afb64f24476c09ba7da479c844bf33ef2870d47c954"
		return asset, nil
	}
	if runtime.GOARCH != "amd64" && runtime.GOARCH != "arm64" {
		return runtimeAsset{}, fmt.Errorf("automatic whisper installation is not available for %s/%s", runtime.GOOS, runtime.GOARCH)
	}
	asset.URL = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-x64.zip"
	asset.SHA256 = "7d8be46ecd31828e1eb7a2ecdd0d6b314feafd82163038ab6092594b0a063539"
	return asset, nil
}

func (c *Client) supportedRuntimeDir() string {
	return filepath.Join(c.runtimesDir, "v"+SupportedWhisperVersion)
}

func (c *Client) binaryPath() string {
	asset, err := supportedRuntimeAsset()
	if err != nil {
		if runtime.GOOS == "windows" {
			return filepath.Join(c.supportedRuntimeDir(), "whisper-cli.exe")
		}
		return filepath.Join(c.supportedRuntimeDir(), "whisper-cli")
	}
	return filepath.Join(c.supportedRuntimeDir(), asset.BinaryName)
}

func parseRuntimeVersion(output string) string {
	match := versionPattern.FindStringSubmatch(output)
	if len(match) != 2 {
		return ""
	}
	return match[1]
}

func (c *Client) validateRuntime(dir string) error {
	asset, err := supportedRuntimeAsset()
	if err != nil {
		return err
	}
	for _, name := range asset.Required {
		info, statErr := os.Stat(filepath.Join(dir, name))
		if statErr != nil || info.IsDir() || info.Size() == 0 {
			return fmt.Errorf("required runtime file is missing or empty: %s", name)
		}
	}
	cpuBackends, err := filepath.Glob(filepath.Join(dir, "ggml-cpu*.dll"))
	if err != nil || len(cpuBackends) == 0 {
		return fmt.Errorf("required ggml CPU backend is missing")
	}

	ctx, cancel := context.WithTimeout(c.baseContext(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, filepath.Join(dir, asset.BinaryName), "--version")
	cmd.Dir = dir
	hideWindow(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("could not read whisper runtime version: %w", err)
	}
	version := parseRuntimeVersion(string(output))
	if version != SupportedWhisperVersion {
		return fmt.Errorf("unsupported whisper runtime version %q (expected %s)", version, SupportedWhisperVersion)
	}
	return nil
}

func (c *Client) IsBinaryInstalled() bool {
	return c.validateRuntime(c.supportedRuntimeDir()) == nil
}

func (c *Client) DownloadBinary() error {
	if c.IsBinaryInstalled() {
		return nil
	}
	if err := c.EnsureDirectories(); err != nil {
		return err
	}
	asset, err := supportedRuntimeAsset()
	if err != nil {
		return err
	}

	c.emitEvent("whisper:binary-progress", map[string]interface{}{"status": "downloading", "percent": 0})
	archivePath, err := c.downloadRuntimeArchive(asset)
	if err != nil {
		return err
	}
	defer os.Remove(archivePath)

	c.emitEvent("whisper:binary-progress", map[string]interface{}{"status": "extracting", "percent": 100})
	stageDir, err := os.MkdirTemp(c.runtimesDir, ".install-v"+SupportedWhisperVersion+"-")
	if err != nil {
		return err
	}
	stageOwned := true
	defer func() {
		if stageOwned {
			_ = os.RemoveAll(stageDir)
		}
	}()

	if err := extractRuntimeArchive(archivePath, stageDir, asset); err != nil {
		return fmt.Errorf("runtime extraction failed: %w", err)
	}
	if err := c.validateRuntime(stageDir); err != nil {
		return fmt.Errorf("downloaded runtime validation failed: %w", err)
	}
	if err := installRuntimeDirectory(stageDir, c.supportedRuntimeDir()); err != nil {
		return err
	}
	stageOwned = false

	c.emitEvent("whisper:binary-progress", map[string]interface{}{"status": "complete", "percent": 100})
	logger.Log.Info().Str("version", SupportedWhisperVersion).Str("path", c.supportedRuntimeDir()).Msg("whisper runtime installed")
	return nil
}

func (c *Client) downloadRuntimeArchive(asset runtimeAsset) (string, error) {
	req, err := http.NewRequestWithContext(c.baseContext(), http.MethodGet, asset.URL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "DownKingo-Launcher/3.0")
	resp, err := (&http.Client{Timeout: 30 * time.Minute}).Do(req)
	if err != nil {
		return "", fmt.Errorf("runtime download failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("runtime download returned HTTP %d", resp.StatusCode)
	}

	out, err := os.CreateTemp(c.whisperDir, "whisper-runtime-*.zip")
	if err != nil {
		return "", err
	}
	path := out.Name()
	ok := false
	defer func() {
		_ = out.Close()
		if !ok {
			_ = os.Remove(path)
		}
	}()

	hash := sha256.New()
	buf := make([]byte, 64*1024)
	var downloaded int64
	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, err := out.Write(buf[:n]); err != nil {
				return "", err
			}
			_, _ = hash.Write(buf[:n])
			downloaded += int64(n)
			if resp.ContentLength > 0 {
				c.emitEvent("whisper:binary-progress", map[string]interface{}{
					"status": "downloading", "percent": float64(downloaded) / float64(resp.ContentLength) * 100,
					"downloaded": downloaded, "total": resp.ContentLength,
				})
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return "", readErr
		}
	}
	if err := out.Close(); err != nil {
		return "", err
	}
	actual := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(actual, asset.SHA256) {
		return "", fmt.Errorf("runtime checksum mismatch: got %s", actual)
	}
	ok = true
	return path, nil
}

func extractRuntimeArchive(archivePath, destination string, asset runtimeAsset) error {
	r, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer r.Close()
	required := make(map[string]bool, len(asset.Required))
	for _, name := range asset.Required {
		required[strings.ToLower(name)] = false
	}
	for _, entry := range r.File {
		name := filepath.Base(entry.Name)
		key := strings.ToLower(name)
		_, isRequired := required[key]
		isRuntimeDLL := strings.HasSuffix(key, ".dll")
		if (!isRequired && !isRuntimeDLL) || entry.FileInfo().IsDir() {
			continue
		}
		rc, err := entry.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(filepath.Join(destination, name), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0755)
		if err != nil {
			rc.Close()
			return err
		}
		_, copyErr := io.Copy(out, rc)
		closeErr := out.Close()
		rc.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if isRequired {
			required[key] = true
		}
	}
	for name, found := range required {
		if !found {
			return fmt.Errorf("required file %s not found in archive", name)
		}
	}
	return nil
}

func installRuntimeDirectory(stageDir, targetDir string) error {
	backupDir := ""
	if _, err := os.Stat(targetDir); err == nil {
		backupDir = fmt.Sprintf("%s.previous-%d", targetDir, time.Now().Unix())
		if err := os.Rename(targetDir, backupDir); err != nil {
			return fmt.Errorf("could not preserve previous runtime: %w", err)
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	if err := os.Rename(stageDir, targetDir); err != nil {
		if backupDir != "" {
			_ = os.Rename(backupDir, targetDir)
		}
		return fmt.Errorf("could not activate whisper runtime: %w", err)
	}
	return nil
}

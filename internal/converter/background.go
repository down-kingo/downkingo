//go:build windows
// +build windows

package converter

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// BackgroundRemovalOptions configures background removal
type BackgroundRemovalOptions struct {
	InputPath  string
	OutputDir  string // If empty, uses same directory as input
	Model      string // AI model to use: u2net, u2netp, u2net_human_seg, silueta
	AlphaOnly  bool   // If true, outputs alpha matte only
	RembgPath  string // Path to rembg binary (Python-based)
	FFmpegPath string // Path to FFmpeg (for format conversion)
}

// BackgroundRemovalResult contains the result of background removal
type BackgroundRemovalResult struct {
	OutputPath string
	InputSize  int64
	OutputSize int64
	Model      string
}

// RemoveBackground removes the background from an image using rembg (AI-based).
// Requires rembg to be installed: pip install rembg[cli]
//
// Note: This is a placeholder implementation. For production use, consider:
// 1. Bundling rembg as a sidecar binary
// 2. Using a compiled ONNX runtime solution
// 3. Using an API service
func RemoveBackground(opts BackgroundRemovalOptions) (*BackgroundRemovalResult, error) {
	if opts.RembgPath == "" {
		return nil, fmt.Errorf("rembg path is required - please install rembg: pip install rembg[cli]")
	}

	if _, err := os.Stat(opts.InputPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("input file does not exist: %s", opts.InputPath)
	}

	// Get input file info
	inputInfo, err := os.Stat(opts.InputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat input file: %w", err)
	}

	// Build output path (always PNG for transparency)
	inputExt := filepath.Ext(opts.InputPath)
	baseName := strings.TrimSuffix(filepath.Base(opts.InputPath), inputExt)
	outputDir := opts.OutputDir
	if outputDir == "" {
		outputDir = filepath.Dir(opts.InputPath)
	}
	outputPath := filepath.Join(outputDir, baseName+"_nobg.png")

	// Default model
	model := opts.Model
	if model == "" {
		model = "u2net" // Best quality general-purpose model
	}

	// Build rembg arguments
	// rembg i -m <model> input.jpg output.png
	args := []string{"i", "-m", model}

	if opts.AlphaOnly {
		args = append(args, "-a") // Alpha matte only
	}

	args = append(args, opts.InputPath, outputPath)

	// Execute rembg
	cmd := exec.Command(opts.RembgPath, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("rembg error: %v | output: %s", err, string(output))
	}

	// Get output file size
	outputInfo, err := os.Stat(outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat output file: %w", err)
	}

	return &BackgroundRemovalResult{
		OutputPath: outputPath,
		InputSize:  inputInfo.Size(),
		OutputSize: outputInfo.Size(),
		Model:      model,
	}, nil
}

// CheckRembgInstalled checks if rembg is available in the system.
func CheckRembgInstalled() (string, bool) {
	// Try common locations
	paths := []string{
		"rembg",                 // In PATH
		"python", "-m", "rembg", // Python module
	}

	// Try rembg directly
	cmd := exec.Command("rembg", "--version")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Run(); err == nil {
		return "rembg", true
	}

	// Try as Python module
	cmd = exec.Command("python", "-m", "rembg.cli", "--version")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Run(); err == nil {
		return "python -m rembg.cli", true
	}

	_ = paths // Silence unused variable warning
	return "", false
}

// GetAvailableModels returns the list of rembg models
func GetAvailableModels() []struct {
	ID          string
	Name        string
	Description string
} {
	return []struct {
		ID          string
		Name        string
		Description string
	}{
		{ID: "u2net", Name: "U²-Net", Description: "Melhor qualidade geral (mais lento)"},
		{ID: "u2netp", Name: "U²-Net Lite", Description: "Boa qualidade, mais rápido"},
		{ID: "u2net_human_seg", Name: "U²-Net Human", Description: "Otimizado para pessoas"},
		{ID: "silueta", Name: "Silueta", Description: "Boa qualidade, muito rápido"},
		{ID: "isnet-general-use", Name: "IS-Net", Description: "Alta precisão em bordas"},
	}
}

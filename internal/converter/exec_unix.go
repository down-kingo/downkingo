//go:build !windows

package converter

import "os/exec"

func setSysProcAttr(cmd *exec.Cmd) {
	// No special attributes needed for Unix-like systems (Linux/macOS)
}

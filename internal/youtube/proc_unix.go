//go:build !windows

package youtube

import "os/exec"

// setSysProcAttr is a no-op on non-Windows platforms
func setSysProcAttr(cmd *exec.Cmd) {
	// Nothing to do on macOS/Linux
}

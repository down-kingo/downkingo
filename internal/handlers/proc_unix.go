//go:build !windows

package handlers

import "os/exec"

// hideWindow is a no-op on non-Windows platforms.
func hideWindow(cmd *exec.Cmd) {
	// Nothing to do on Unix
}

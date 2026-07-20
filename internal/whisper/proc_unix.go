//go:build !windows

package whisper

import "os/exec"

// hideWindow is a no-op on non-Windows platforms.
func hideWindow(cmd *exec.Cmd) {
	// Nothing to do on Unix
}

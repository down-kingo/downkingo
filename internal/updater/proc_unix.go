//go:build !windows

package updater

import "os/exec"

// hideUpdaterWindow is a no-op on non-Windows platforms.
func hideUpdaterWindow(cmd *exec.Cmd) {
	// Nothing to do on Unix
}

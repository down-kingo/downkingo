package handlers

import (
	"os/exec"
	"syscall"
)

// hideWindow configures the command to not show a console window on Windows.
func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}

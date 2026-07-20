package updater

import (
	"os/exec"
	"syscall"
)

// hideUpdaterWindow hides the console window of the updater subprocess on Windows.
func hideUpdaterWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}
}

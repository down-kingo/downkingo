//go:build windows

package youtube

import (
	"os/exec"
	"syscall"
)

// setSysProcAttr configures Windows-specific process attributes
// to hide the console window when running yt-dlp
func setSysProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
}

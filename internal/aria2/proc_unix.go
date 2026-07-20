//go:build !windows

package aria2

import "os/exec"

func hideWindow(_ *exec.Cmd) {}

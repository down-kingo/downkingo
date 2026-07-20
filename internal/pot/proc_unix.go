//go:build !windows

package pot

import "os/exec"

func hideWindow(_ *exec.Cmd) {}

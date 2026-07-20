//go:build !windows

package main

import (
	"fmt"
	"os/exec"
)

func launchInstaller(path string) error {
	if err := exec.Command(path).Start(); err != nil {
		return fmt.Errorf("could not launch installer: %w", err)
	}
	return nil
}

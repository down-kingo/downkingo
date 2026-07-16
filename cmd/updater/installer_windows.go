//go:build windows

package main

import (
	"fmt"

	"golang.org/x/sys/windows"
)

func launchInstaller(path string) error {
	verb, err := windows.UTF16PtrFromString("runas")
	if err != nil {
		return fmt.Errorf("invalid elevation verb: %w", err)
	}
	file, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return fmt.Errorf("invalid installer path: %w", err)
	}

	if err := windows.ShellExecute(0, verb, file, nil, nil, windows.SW_NORMAL); err != nil {
		return fmt.Errorf("could not request installer elevation: %w", err)
	}
	return nil
}

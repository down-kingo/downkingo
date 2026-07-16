package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"syscall"
	"time"
)

func main() {
	pid := flag.Int("pid", 0, "PID of the running app to wait for")
	oldPath := flag.String("old", "", "Path to the current executable")
	newPath := flag.String("new", "", "Path to the downloaded update binary")
	installerPath := flag.String("installer", "", "Path to the downloaded installer")
	cleanup := flag.String("cleanup", "", "Path to this updater binary (self-cleanup)")
	flag.Parse()

	if *pid == 0 || (*installerPath == "" && (*oldPath == "" || *newPath == "")) {
		fmt.Fprintln(os.Stderr, "Usage: updater --pid <PID> (--installer <setup> | --old <exe> --new <update>) [--cleanup <self>]")
		os.Exit(1)
	}

	// 1. Wait for the main app process to exit (timeout 30s)
	if err := waitForProcessExit(*pid, 30*time.Second); err != nil {
		fmt.Fprintf(os.Stderr, "Timeout waiting for PID %d: %v\n", *pid, err)
		os.Exit(1)
	}

	// Small grace period to ensure file handles are released
	time.Sleep(500 * time.Millisecond)

	// Windows installations live under Program Files and must be upgraded by
	// the NSIS installer with elevation. Never replace the application binary
	// with the installer itself.
	if *installerPath != "" {
		if err := launchInstaller(*installerPath); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to launch installer: %v\n", err)
			os.Exit(1)
		}
		selfCleanup(*cleanup, *installerPath)
		return
	}

	// 2. Remove stale .old backup if it exists
	backupPath := *oldPath + ".old"
	os.Remove(backupPath)

	// 3. Rename current exe → .old (backup)
	if err := os.Rename(*oldPath, backupPath); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to backup current executable: %v\n", err)
		os.Exit(1)
	}

	// 4. Move new binary → original path
	if err := os.Rename(*newPath, *oldPath); err != nil {
		// Rollback: restore backup
		if rollbackErr := os.Rename(backupPath, *oldPath); rollbackErr != nil {
			fmt.Fprintf(os.Stderr, "Rollback also failed: %v\n", rollbackErr)
		}
		fmt.Fprintf(os.Stderr, "Failed to install update: %v\n", err)
		os.Exit(1)
	}

	// 5. Relaunch the updated app
	cmd := exec.Command(*oldPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to relaunch app: %v\n", err)
		os.Exit(1)
	}

	// 6. Cleanup: remove .old backup (best-effort)
	if err := os.Remove(backupPath); err != nil && !os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Warning: could not remove backup file %s: %v\n", backupPath, err)
	}

	// 7. Self-cleanup: on Windows we cannot delete our own running exe,
	// so we spawn a detached cmd.exe that waits briefly then deletes us.
	selfCleanup(*cleanup)
}

// selfCleanup removes the given file.
// On Windows, a process cannot delete its own running executable, so we
// spawn a detached cmd.exe with a short delay to do the removal after we exit.
func selfCleanup(paths ...string) {
	if runtime.GOOS == "windows" {
		hasPaths := false
		for _, path := range paths {
			hasPaths = hasPaths || path != ""
		}
		if !hasPaths {
			return
		}

		// Give the installer enough time to finish reading itself before deleting
		// both temporary files. Empty paths are ignored.
		script := `timeout /t 300 /nobreak > NUL`
		for _, path := range paths {
			if path != "" {
				script += fmt.Sprintf(` & del /f /q "%s"`, path)
			}
		}
		cmd := exec.Command("cmd", "/c", script)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
			HideWindow:    true,
		}
		if err := cmd.Start(); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: could not schedule self-cleanup: %v\n", err)
		}
		return
	}
	for _, path := range paths {
		// On Unix, removing a running executable unlinks the directory entry but
		// the file stays accessible via its open file descriptor until we exit.
		if path != "" {
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				fmt.Fprintf(os.Stderr, "Warning: could not remove temporary file: %v\n", err)
			}
		}
	}
}

func waitForProcessExit(pid int, timeout time.Duration) error {
	if runtime.GOOS == "windows" {
		return waitForProcessExitWindows(pid, timeout)
	}
	return waitForProcessExitUnix(pid, timeout)
}

func waitForProcessExitWindows(pid int, timeout time.Duration) error {
	const SYNCHRONIZE = 0x00100000
	handle, err := syscall.OpenProcess(SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		return nil // Process doesn't exist or can't be accessed — treat as exited
	}
	defer func() {
		if err := syscall.CloseHandle(handle); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: could not close process handle: %v\n", err)
		}
	}()

	// WaitForSingleObject with timeout in milliseconds
	millis := uint32(timeout.Milliseconds())
	event, err := syscall.WaitForSingleObject(handle, millis)
	if err != nil {
		return fmt.Errorf("wait failed: %w", err)
	}
	if event == syscall.WAIT_TIMEOUT {
		return fmt.Errorf("process %d did not exit within %v", pid, timeout)
	}
	return nil
}

func waitForProcessExitUnix(pid int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		proc, err := os.FindProcess(pid)
		if err != nil {
			return nil
		}
		err = proc.Signal(syscall.Signal(0))
		if err != nil {
			return nil // Process is gone
		}
		time.Sleep(500 * time.Millisecond)
	}
	return fmt.Errorf("process %d did not exit within %v", pid, timeout)
}

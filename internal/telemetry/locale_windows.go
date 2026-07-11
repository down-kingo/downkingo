package telemetry

import (
	"syscall"
	"unsafe"
)

// getOSLocale uses the Windows API (GetUserDefaultLocaleName) to detect locale
// without spawning a subprocess. This prevents the terminal window flash that
// occurred when using powershell.
func getOSLocale() string {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	proc := kernel32.NewProc("GetUserDefaultLocaleName")

	buf := make([]uint16, 85) // LOCALE_NAME_MAX_LENGTH = 85
	r, _, _ := proc.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	if r == 0 {
		return ""
	}
	return syscall.UTF16ToString(buf)
}

//go:build !windows

package telemetry

// getOSLocale is a no-op on non-Windows platforms.
// Locale detection falls back to environment variables in getSystemLocale.
func getOSLocale() string {
	return ""
}

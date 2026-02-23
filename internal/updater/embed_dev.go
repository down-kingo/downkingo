//go:build dev

package updater

// In dev mode, no updater binary is embedded.
// Update attempts will return a friendly error.
var updaterBinary []byte

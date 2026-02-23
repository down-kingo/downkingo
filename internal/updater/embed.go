//go:build !dev

package updater

import _ "embed"

//go:embed updater.exe
var updaterBinary []byte

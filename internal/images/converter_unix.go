//go:build !windows

package images

import "syscall"

// getSysProcAttr retorna nil para sistemas Unix (Linux/macOS).
// Não há necessidade de esconder janelas de console nesses sistemas.
func getSysProcAttr() *syscall.SysProcAttr {
	return nil
}

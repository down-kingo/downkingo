//go:build windows

package images

import "syscall"

// getSysProcAttr retorna os atributos de processo específicos para Windows.
// HideWindow: true evita que uma janela de console apareça ao executar FFmpeg.
func getSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{HideWindow: true}
}

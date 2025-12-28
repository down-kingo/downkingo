// Package events centraliza todas as strings de eventos do Wails
// para evitar magic strings espalhadas pelo código
package events

// Eventos do Launcher (download de dependências)
const (
	LauncherProgress = "launcher:progress"
	LauncherComplete = "launcher:complete"
)

// Eventos de Download (yt-dlp)
const (
	DownloadProgress = "download:progress"
)

// Eventos de Ciclo de Vida da Aplicação
const (
	AppReady = "app:ready"
)

// Eventos do Updater
const (
	UpdateProgress = "update:progress"
	UpdateComplete = "update:complete"
)

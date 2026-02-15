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
	DownloadAdded    = "download:added"
	DownloadComplete = "download:complete"
	DownloadFailed   = "download:failed"
	QueueUpdated     = "queue:updated"
	DownloadLog      = "download:log"
	ConsoleLog       = "console:log" // Logs amigáveis para o usuário final
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

// Eventos do Whisper (Transcrição)
const (
	WhisperModelProgress     = "whisper:model-progress"
	WhisperTranscribeProgress = "whisper:transcribe-progress"
)

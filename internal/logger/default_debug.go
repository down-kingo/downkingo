//go:build dev || debug

package logger

import "github.com/rs/zerolog"

// defaultLevel define o nível padrão para builds de desenvolvimento (Debug)
// Isso é ativado automaticamente via "wails dev" (tag 'dev')
var defaultLevel = zerolog.DebugLevel

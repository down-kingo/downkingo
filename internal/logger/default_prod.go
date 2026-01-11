//go:build !dev && !debug

package logger

import "github.com/rs/zerolog"

// defaultLevel define o nível padrão para builds de produção (Info)
// Isso é ativado automaticamente em builds finais (sem tag 'dev' ou 'debug')
var defaultLevel = zerolog.InfoLevel

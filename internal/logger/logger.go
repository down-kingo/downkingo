package logger

import (
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog"
)

// Log é o logger global da aplicação
var Log zerolog.Logger

// Init inicializa o logger com saída para arquivo em appDataDir/logs/
func Init(appDataDir string) error {
	logDir := filepath.Join(appDataDir, "logs")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}

	// Nome do arquivo com data para facilitar debug
	logFileName := "downkingo.log"
	logPath := filepath.Join(logDir, logFileName)

	logFile, err := os.OpenFile(
		logPath,
		os.O_APPEND|os.O_CREATE|os.O_WRONLY,
		0644,
	)
	if err != nil {
		return err
	}

	// Configurar formato de tempo legível
	zerolog.TimeFieldFormat = time.RFC3339

	// Multi-writer: apenas arquivo em produção
	writers := []io.Writer{logFile}

	multi := zerolog.MultiLevelWriter(writers...)

	Log = zerolog.New(multi).
		With().
		Timestamp().
		Caller(). // Inclui arquivo:linha para debug
		Logger()

	Log.Info().Str("logPath", logPath).Msg("logger initialized")
	return nil
}

// GetLogPath retorna o caminho do diretório de logs
func GetLogPath(appDataDir string) string {
	return filepath.Join(appDataDir, "logs")
}

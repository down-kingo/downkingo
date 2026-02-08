package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// Log is the global application logger.
var Log zerolog.Logger

const (
	maxLogSize    = 10 * 1024 * 1024 // 10 MB per file
	maxLogBackups = 5                // keep 5 rotated files
)

// Init initializes the logger with file output and rotation in appDataDir/logs/.
func Init(appDataDir string) error {
	logDir := filepath.Join(appDataDir, "logs")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}

	logPath := filepath.Join(logDir, "downkingo.log")

	writer := &rotatingWriter{
		path:       logPath,
		maxSize:    maxLogSize,
		maxBackups: maxLogBackups,
	}

	if err := writer.open(); err != nil {
		return err
	}

	zerolog.TimeFieldFormat = time.RFC3339

	logLevel := defaultLevel
	if os.Getenv("KINGO_DEBUG") == "true" || os.Getenv("KINGO_DEBUG") == "1" {
		logLevel = zerolog.DebugLevel
	}
	zerolog.SetGlobalLevel(logLevel)

	writers := []io.Writer{writer}
	multi := zerolog.MultiLevelWriter(writers...)

	Log = zerolog.New(multi).
		With().
		Timestamp().
		Caller().
		Logger()

	Log.Info().Str("logPath", logPath).Msg("logger initialized")
	return nil
}

// GetLogPath returns the log directory path.
func GetLogPath(appDataDir string) string {
	return filepath.Join(appDataDir, "logs")
}

// rotatingWriter implements io.Writer with size-based log rotation.
// When the current file exceeds maxSize, it is renamed to a timestamped
// backup and a new file is created. Old backups beyond maxBackups are removed.
type rotatingWriter struct {
	mu         sync.Mutex
	path       string
	maxSize    int64
	maxBackups int
	file       *os.File
	size       int64
}

func (w *rotatingWriter) open() error {
	f, err := os.OpenFile(w.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}

	info, err := f.Stat()
	if err != nil {
		f.Close()
		return err
	}

	w.file = f
	w.size = info.Size()
	return nil
}

func (w *rotatingWriter) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.size+int64(len(p)) > w.maxSize {
		if err := w.rotate(); err != nil {
			// If rotation fails, continue writing to current file
			fmt.Fprintf(os.Stderr, "log rotation failed: %v\n", err)
		}
	}

	n, err = w.file.Write(p)
	w.size += int64(n)
	return n, err
}

func (w *rotatingWriter) rotate() error {
	// Close current file
	if err := w.file.Close(); err != nil {
		return err
	}

	// Rename current file to timestamped backup
	backupName := w.backupName()
	if err := os.Rename(w.path, backupName); err != nil {
		// If rename fails, try to reopen the original
		w.open()
		return err
	}

	// Open new file
	if err := w.open(); err != nil {
		return err
	}

	// Clean old backups (async to not block writes)
	go w.cleanOldBackups()

	return nil
}

func (w *rotatingWriter) backupName() string {
	dir := filepath.Dir(w.path)
	ext := filepath.Ext(w.path)
	base := strings.TrimSuffix(filepath.Base(w.path), ext)
	timestamp := time.Now().Format("2006-01-02T15-04-05")
	return filepath.Join(dir, fmt.Sprintf("%s-%s%s", base, timestamp, ext))
}

func (w *rotatingWriter) cleanOldBackups() {
	dir := filepath.Dir(w.path)
	ext := filepath.Ext(w.path)
	base := strings.TrimSuffix(filepath.Base(w.path), ext)
	prefix := base + "-"

	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	var backups []string
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, prefix) && strings.HasSuffix(name, ext) {
			backups = append(backups, filepath.Join(dir, name))
		}
	}

	// Sort by name (oldest first since timestamps are sortable)
	sort.Strings(backups)

	// Remove excess backups
	for len(backups) > w.maxBackups {
		os.Remove(backups[0])
		backups = backups[1:]
	}
}

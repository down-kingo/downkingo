// Package validate provides input validation functions for URLs, paths, and other user inputs.
// All public-facing inputs should be validated before processing.
package validate

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	apperr "kingo/internal/errors"
)

// SupportedPlatforms defines the list of platforms supported by the application.
var SupportedPlatforms = []string{
	"youtube.com", "youtu.be",
	"instagram.com",
	"tiktok.com",
	"twitter.com", "x.com",
	"facebook.com", "fb.watch",
	"twitch.tv",
	"vimeo.com",
	"dailymotion.com",
	"pinterest.com",
	"reddit.com",
	"threads.net",
	"soundcloud.com",
}

// DangerousPathPatterns are patterns that could indicate path traversal attacks.
var DangerousPathPatterns = []string{
	"..",
	"~",
	"$",
	"%",
}

// filenameUnsafeChars matches characters not allowed in filenames.
var filenameUnsafeChars = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]`)

// URL validates a URL and returns the parsed URL or an error.
func URL(rawURL string) (*url.URL, error) {
	if rawURL == "" {
		return nil, apperr.NewWithMessage("validate.URL", apperr.ErrInvalidURL, "URL não pode estar vazia")
	}

	// Trim whitespace
	rawURL = strings.TrimSpace(rawURL)

	// Check for valid HTTP(S) scheme
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		return nil, apperr.NewWithMessage("validate.URL", apperr.ErrInvalidURL, "URL deve começar com http:// ou https://")
	}

	// Parse URL
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, apperr.NewWithMessage("validate.URL", apperr.ErrInvalidURL, "URL inválida")
	}

	// Validate host
	if parsed.Host == "" {
		return nil, apperr.NewWithMessage("validate.URL", apperr.ErrInvalidURL, "URL sem host válido")
	}

	return parsed, nil
}

// MediaURL validates a URL and checks if it's from a supported platform.
func MediaURL(rawURL string) (*url.URL, error) {
	parsed, err := URL(rawURL)
	if err != nil {
		return nil, err
	}

	// Check if platform is supported
	host := strings.ToLower(parsed.Host)
	supported := false
	for _, platform := range SupportedPlatforms {
		if strings.Contains(host, platform) {
			supported = true
			break
		}
	}

	if !supported {
		return nil, apperr.NewWithMessage("validate.MediaURL", apperr.ErrUnsupportedPlatform,
			fmt.Sprintf("Plataforma não suportada: %s", parsed.Host))
	}

	return parsed, nil
}

// DirectoryPath validates a directory path.
// Returns the cleaned absolute path or an error.
func DirectoryPath(path string) (string, error) {
	if path == "" {
		return "", apperr.NewWithMessage("validate.DirectoryPath", apperr.ErrInvalidURL, "caminho não pode estar vazio")
	}

	// Check for dangerous patterns (path traversal)
	for _, pattern := range DangerousPathPatterns {
		if strings.Contains(path, pattern) {
			return "", apperr.NewWithMessage("validate.DirectoryPath", apperr.ErrPermissionDenied,
				"caminho contém caracteres não permitidos")
		}
	}

	// Clean and get absolute path
	cleanPath := filepath.Clean(path)
	absPath, err := filepath.Abs(cleanPath)
	if err != nil {
		return "", apperr.Wrap("validate.DirectoryPath", err)
	}

	// Check if directory exists
	info, err := os.Stat(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Directory doesn't exist, but path is valid - caller can create it
			return absPath, nil
		}
		return "", apperr.Wrap("validate.DirectoryPath", err)
	}

	// Check if it's actually a directory
	if !info.IsDir() {
		return "", apperr.NewWithMessage("validate.DirectoryPath", apperr.ErrInvalidURL, "caminho não é um diretório")
	}

	return absPath, nil
}

// Filename sanitizes a filename to be safe for the filesystem.
func Filename(name string) string {
	if name == "" {
		return "untitled"
	}

	// Remove unsafe characters
	safe := filenameUnsafeChars.ReplaceAllString(name, "_")

	// Trim spaces and dots from start/end
	safe = strings.Trim(safe, " .")

	// Limit length
	if len(safe) > 200 {
		safe = safe[:200]
	}

	// Ensure not empty after sanitization
	if safe == "" {
		return "untitled"
	}

	return safe
}

// QualityValue validates a quality value (0-100).
func QualityValue(quality int) int {
	if quality < 0 {
		return 0
	}
	if quality > 100 {
		return 100
	}
	return quality
}

// Format validates a media format string.
func Format(format string, allowedFormats []string) (string, error) {
	format = strings.ToLower(strings.TrimSpace(format))

	if format == "" {
		return allowedFormats[0], nil // Default to first allowed format
	}

	for _, allowed := range allowedFormats {
		if format == allowed {
			return format, nil
		}
	}

	return "", apperr.NewWithMessage("validate.Format", apperr.ErrInvalidURL,
		fmt.Sprintf("formato não suportado: %s", format))
}

// PositiveInt ensures an integer is positive, returning a default if not.
func PositiveInt(value, defaultValue int) int {
	if value <= 0 {
		return defaultValue
	}
	return value
}

// NonEmptyString returns the string or a default if empty.
func NonEmptyString(value, defaultValue string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return defaultValue
	}
	return value
}

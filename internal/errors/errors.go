// Package errors provides custom error types and error handling utilities.
// Following Go idioms, errors are values that carry context about what went wrong.
package errors

import (
	"errors"
	"fmt"
)

// Standard sentinel errors for the application.
// These can be checked with errors.Is() for specific error handling.
var (
	// ErrNotFound indicates a resource was not found.
	ErrNotFound = errors.New("resource not found")

	// ErrAlreadyExists indicates a duplicate resource.
	ErrAlreadyExists = errors.New("resource already exists")

	// ErrInvalidURL indicates an invalid or malformed URL.
	ErrInvalidURL = errors.New("invalid URL")

	// ErrUnsupportedPlatform indicates the URL's platform is not supported.
	ErrUnsupportedPlatform = errors.New("unsupported platform")

	// ErrDependencyMissing indicates a required binary is not installed.
	ErrDependencyMissing = errors.New("required dependency not installed")

	// ErrDownloadFailed indicates a download operation failed.
	ErrDownloadFailed = errors.New("download failed")

	// ErrConversionFailed indicates a media conversion failed.
	ErrConversionFailed = errors.New("conversion failed")

	// ErrPermissionDenied indicates insufficient permissions.
	ErrPermissionDenied = errors.New("permission denied")

	// ErrTimeout indicates an operation timed out.
	ErrTimeout = errors.New("operation timed out")

	// ErrCancelled indicates an operation was cancelled by user.
	ErrCancelled = errors.New("operation cancelled")

	// ErrRateLimited indicates too many requests were made.
	ErrRateLimited = errors.New("rate limited")

	// ErrAuthRequired indicates authentication is required.
	ErrAuthRequired = errors.New("authentication required")
)

// AppError is a structured error type that carries additional context.
type AppError struct {
	Op      string // Operation that failed (e.g., "VideoHandler.GetVideoInfo")
	Err     error  // Underlying error
	Message string // User-friendly message
	Code    string // Error code for frontend handling
}

// Error implements the error interface.
func (e *AppError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("%s: %s", e.Op, e.Message)
	}
	return fmt.Sprintf("%s: %v", e.Op, e.Err)
}

// Unwrap allows errors.Is and errors.As to work with wrapped errors.
func (e *AppError) Unwrap() error {
	return e.Err
}

// New creates a new AppError with the given operation and error.
func New(op string, err error) *AppError {
	return &AppError{
		Op:  op,
		Err: err,
	}
}

// NewWithMessage creates a new AppError with a user-friendly message.
func NewWithMessage(op string, err error, message string) *AppError {
	return &AppError{
		Op:      op,
		Err:     err,
		Message: message,
	}
}

// NewWithCode creates a new AppError with an error code for frontend handling.
func NewWithCode(op string, err error, code string, message string) *AppError {
	return &AppError{
		Op:      op,
		Err:     err,
		Code:    code,
		Message: message,
	}
}

// Wrap wraps an existing error with operation context.
func Wrap(op string, err error) error {
	if err == nil {
		return nil
	}
	return &AppError{Op: op, Err: err}
}

// WrapWithMessage wraps an error with a user-friendly message.
func WrapWithMessage(op string, err error, message string) error {
	if err == nil {
		return nil
	}
	return &AppError{Op: op, Err: err, Message: message}
}

// IsNotFound checks if an error is a "not found" error.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

// IsCancelled checks if an error is a cancellation error.
func IsCancelled(err error) bool {
	return errors.Is(err, ErrCancelled)
}

// IsTimeout checks if an error is a timeout error.
func IsTimeout(err error) bool {
	return errors.Is(err, ErrTimeout)
}

// IsAuthRequired checks if an error requires authentication.
func IsAuthRequired(err error) bool {
	return errors.Is(err, ErrAuthRequired)
}

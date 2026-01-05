package errors_test

import (
	"errors"
	"testing"

	apperr "kingo/internal/errors"
)

func TestAppError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      *apperr.AppError
		expected string
	}{
		{
			name:     "with message",
			err:      apperr.NewWithMessage("TestOp", apperr.ErrInvalidURL, "URL inválida"),
			expected: "TestOp: URL inválida",
		},
		{
			name:     "without message",
			err:      apperr.New("TestOp", apperr.ErrNotFound),
			expected: "TestOp: resource not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Error(); got != tt.expected {
				t.Errorf("Error() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestAppError_Unwrap(t *testing.T) {
	originalErr := apperr.ErrNotFound
	wrappedErr := apperr.New("TestOp", originalErr)

	if !errors.Is(wrappedErr, originalErr) {
		t.Error("Unwrap() should allow errors.Is to find the original error")
	}
}

func TestWrap_NilError(t *testing.T) {
	result := apperr.Wrap("TestOp", nil)
	if result != nil {
		t.Error("Wrap(nil) should return nil")
	}
}

func TestSentinelErrors(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		checkFn  func(error) bool
		expected bool
	}{
		{"IsNotFound positive", apperr.ErrNotFound, apperr.IsNotFound, true},
		{"IsNotFound negative", apperr.ErrTimeout, apperr.IsNotFound, false},
		{"IsCancelled positive", apperr.ErrCancelled, apperr.IsCancelled, true},
		{"IsCancelled negative", apperr.ErrTimeout, apperr.IsCancelled, false},
		{"IsTimeout positive", apperr.ErrTimeout, apperr.IsTimeout, true},
		{"IsAuthRequired positive", apperr.ErrAuthRequired, apperr.IsAuthRequired, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.checkFn(tt.err); got != tt.expected {
				t.Errorf("check(%v) = %v, want %v", tt.err, got, tt.expected)
			}
		})
	}
}

func TestWrappedErrorPreservesIs(t *testing.T) {
	// Wrap an error multiple times
	original := apperr.ErrAuthRequired
	wrapped1 := apperr.Wrap("Layer1", original)
	wrapped2 := apperr.Wrap("Layer2", wrapped1)

	// errors.Is should still find the original
	if !errors.Is(wrapped2, original) {
		t.Error("Deeply wrapped error should still match with errors.Is")
	}
}

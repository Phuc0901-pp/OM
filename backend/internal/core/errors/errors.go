package errors

import "errors"

var (
	ErrNotFound          = errors.New("resource not found")
	ErrConflict          = errors.New("resource conflict (version mismatch)")
	ErrInvalidState      = errors.New("invalid state transition")
	ErrInvalidInput      = errors.New("invalid input")
	ErrUnauthorized      = errors.New("unauthorized")
	ErrInternalServer    = errors.New("internal server error")
	ErrAssetRequired     = errors.New("asset is required")
	ErrRequesterRequired = errors.New("requester is required")
)

type DomainError struct {
	Code    int
	Message string
	Err     error
}

func (e *DomainError) Error() string {
	return e.Message
}

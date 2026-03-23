package errors

import "net/http"

type AppError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"-"`
}

func (e *AppError) Error() string {
	return e.Message
}

func NewAppError(code int, message string, status int) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  status,
	}
}

// Common Errors
var (
	ErrNotFound            = NewAppError(1001, "Resource not found", http.StatusNotFound)
	ErrUnauthorized        = NewAppError(1002, "Unauthorized access", http.StatusUnauthorized)
	ErrForbidden           = NewAppError(1003, "Access forbidden", http.StatusForbidden)
	ErrInternalServer      = NewAppError(1004, "Internal server error", http.StatusInternalServerError)
	ErrBadRequest          = NewAppError(1005, "Bad request", http.StatusBadRequest)
	ErrValidation          = NewAppError(1006, "Validation error", http.StatusBadRequest)
	ErrDatabase            = NewAppError(1007, "Database error", http.StatusInternalServerError)
    ErrInvalidInput        = NewAppError(1008, "Invalid input", http.StatusBadRequest)
	ErrConflict            = NewAppError(1009, "Resource conflict", http.StatusConflict)
	ErrInvalidState        = NewAppError(1010, "Invalid state", http.StatusPreconditionFailed)
)

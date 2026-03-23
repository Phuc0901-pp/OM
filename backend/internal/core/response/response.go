package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	"go.uber.org/zap"
)

// APIResponse is the standardized JSON envelope for all API responses.
type APIResponse struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Message   string      `json:"message,omitempty"`
	ErrorCode int         `json:"error_code,omitempty"`
}

// Success sends a 200 OK response with data.
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    data,
	})
}

// Created sends a 201 Created response.
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, APIResponse{
		Success: true,
		Data:    data,
		Message: "Created successfully",
	})
}

// BadRequest sends a 400 error with a user-readable message.
func BadRequest(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, APIResponse{
		Success:   false,
		Message:   message,
		ErrorCode: 1005,
	})
}

// InternalError logs the real error to the structured logger but
// returns a generic safe message to the client — never leaking DB details.
func InternalError(c *gin.Context, realErr error, context string) {
	logger.Error("Internal server error",
		zap.String("context", context),
		zap.String("method", c.Request.Method),
		zap.String("path", c.Request.URL.Path),
		zap.Error(realErr),
	)
	c.JSON(http.StatusInternalServerError, APIResponse{
		Success:   false,
		Message:   "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
		ErrorCode: 1004,
	})
}

// NotFound sends a 404 error.
func NotFound(c *gin.Context, message string) {
	c.JSON(http.StatusNotFound, APIResponse{
		Success:   false,
		Message:   message,
		ErrorCode: 1001,
	})
}

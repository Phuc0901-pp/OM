package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/core/errors"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	"go.uber.org/zap"
)

func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Check if any errors occurred during the request
		if len(c.Errors) > 0 {
			err := c.Errors.Last().Err
			var appErr *errors.AppError

			// Check if it's our custom AppError
			if e, ok := err.(*errors.AppError); ok {
				appErr = e
			} else {
				// Default to Internal Server Error for unknown errors
				appErr = errors.ErrInternalServer
				// Log unknown errors with structured logging for debugging
				logger.Error("Unhandled error in request",
					zap.String("method", c.Request.Method),
					zap.String("path", c.Request.URL.Path),
					zap.Error(err),
				)
			}

			c.JSON(appErr.Status, gin.H{
				"error": gin.H{
					"code":    appErr.Code,
					"message": appErr.Message,
				},
			})
		}
	}
}

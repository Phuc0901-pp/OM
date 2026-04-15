package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/adapters/http/handlers"
)

// MaintenanceGuard blocks write operations (POST/PUT/PATCH/DELETE) from non-manager roles
// when the system is in maintenance mode. GET requests and manager/admin roles are always allowed.
func MaintenanceGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only block write methods
		method := c.Request.Method
		if method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions {
			c.Next()
			return
		}

		// Only block if maintenance is active
		if !handlers.IsMaintenanceActive() {
			c.Next()
			return
		}

		// Allow managers and admins through
		role, _ := c.Get("role")
		roleStr, _ := role.(string)
		if roleStr == "manager" || roleStr == "admin" {
			c.Next()
			return
		}

		// Block everyone else
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Hệ thống đang bảo trì. Vui lòng thử lại sau.",
			"code":    "MAINTENANCE_MODE",
			"active":  true,
		})
	}
}

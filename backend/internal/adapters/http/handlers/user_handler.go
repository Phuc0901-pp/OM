package handlers

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
)

type UserHandler struct {
	userService *services.UserService
}

func NewUserHandler(userService *services.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

func (h *UserHandler) GetAllUsers(c *gin.Context) {
	// Check if email query param exists
	email := c.Query("email")
	if email != "" {
		user, err := h.userService.GetUserByEmail(email)
		if err != nil {
			log.Printf("Error fetching user by email: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user", "details": err.Error()})
			return
		}
		// Return as a list to maintain compatibility with the frontend expectation (response.data[0])
		c.JSON(http.StatusOK, []domain.User{*user})
		return
	}

	users, err := h.userService.GetAllUsers()
	if err != nil {
		// Log the actual error for debugging
		log.Printf("Error fetching users: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, users)
}


func (h *UserHandler) GetUserByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	user, err := h.userService.GetUserByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user", "details": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, user)
}

type CreateUserRequest struct {
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required,min=6"`
	FullName       string `json:"full_name" binding:"required"`
	RoleID         string `json:"role_id" binding:"required"`
	TeamID         string `json:"team_id"`
	NumberPhone    string `json:"number_phone"`
}

func (h *UserHandler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Lấy ID người đang đăng nhập từ JWT (set bởi auth middleware)
	creatorIDStr := ""
	if uid, exists := c.Get("user_id"); exists {
		creatorIDStr = fmt.Sprintf("%v", uid)
	}

	user, err := h.userService.CreateUser(req.Email, req.Password, req.FullName, req.RoleID, req.TeamID, req.NumberPhone, creatorIDStr)
	if err != nil {
		log.Printf("[CreateUser] Backend Error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (h *UserHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	if err := h.userService.DeleteUser(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

type UpdateUserRoleRequest struct {
	RoleID string `json:"role_id" binding:"required"`
}

func (h *UserHandler) UpdateUserRole(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	var req UpdateUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	if err := h.userService.UpdateUserRole(id, req.RoleID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User role updated successfully"})
}

type UpdateUserRequest struct {
	Email       string `json:"email"`
	FullName    string `json:"full_name"`
	NumberPhone string `json:"number_phone"`
	RoleID      string `json:"role_id"`
	TeamID      string `json:"team_id"`
	Password    string `json:"password"`
}

func (h *UserHandler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	user, err := h.userService.UpdateUser(id, req.Email, req.FullName, req.NumberPhone, req.RoleID, req.TeamID, req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}


type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

func (h *UserHandler) ChangePassword(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	if err := h.userService.ChangePassword(id, req.OldPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Mật khẩu đã được thay đổi thành công"})
}

// ---- User Trash APIs ----

// GET /users/history - list soft-deleted users
func (h *UserHandler) ListDeletedUsers(c *gin.Context) {
	users, err := h.userService.GetDeletedUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch deleted users"})
		return
	}
	c.JSON(http.StatusOK, users)
}

// POST /users/:id/restore
func (h *UserHandler) RestoreUser(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}
	if err := h.userService.RestoreUser(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore user", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User restored successfully"})
}

// DELETE /users/:id/permanent
func (h *UserHandler) PermanentDeleteUser(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}
	if err := h.userService.PermanentDeleteUser(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanently delete user", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User permanently deleted"})
}

// POST /users/bulk-restore
func (h *UserHandler) BulkRestoreUsers(c *gin.Context) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.userService.BulkRestoreUsers(body.IDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bulk restore users", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Users restored", "count": len(body.IDs)})
}

// DELETE /users/bulk-permanent
func (h *UserHandler) BulkPermanentDeleteUsers(c *gin.Context) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.userService.BulkPermanentDeleteUsers(body.IDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bulk delete users", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Users permanently deleted", "count": len(body.IDs)})
}

package handlers

import (
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

func (h *UserHandler) GetMyTeam(c *gin.Context) {
	managerID := c.Query("manager_id")
	if managerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Manager ID is required"})
		return
	}

	users, err := h.userService.GetUsersByLeaderID(managerID)
	if err != nil {
		log.Printf("[DEBUG] GetMyTeam Error - ManagerID: %s, Error: %v", managerID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch team members", "details": err.Error()})
		return
	}

	// Debug & Fix: Inspect assignments and manually populate missing Project data if Preload failed
	for i := range users {
		if len(users[i].Assigns) > 0 {
			// log.Printf("[DEBUG] Checking assignments for user: %s", users[i].FullName)
			for j := range users[i].Assigns {
				assign := &users[i].Assigns[j]
				// log.Printf("[DEBUG] Assign[%d] ID: %s, ProjectID: %s", j, assign.ID, assign.ProjectID)
				
				if assign.Project == nil {
					// log.Printf("[DEBUG] Assign[%d] Project is NIL via Preload. Attempting manual lookup...", j)
					var p domain.Project
					if err := h.userService.GetDB().First(&p, "project_id = ?", assign.ProjectID).Error; err == nil {
						// log.Printf("[DEBUG] Manual lookup SUCCESS: Found Project '%s'", p.ProjectName)
						// Manually attach the found project so it appears in the JSON response
						// Need to dereference carefully if needed, but Project is *Project in Assign struct
						users[i].Assigns[j].Project = &p
					}
				}
			}
		}
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
	TelegramChatID string `json:"telegram_chat_id"`
	LeaderID       string `json:"leader_id"` // Optional: auto-assign leader (e.g. manager creating their own team member)
}

func (h *UserHandler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	user, err := h.userService.CreateUser(req.Email, req.Password, req.FullName, req.RoleID, req.TeamID, req.NumberPhone, req.TelegramChatID, req.LeaderID)
	if err != nil {
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
	Email          string `json:"email"`
	FullName       string `json:"full_name"`
	NumberPhone    string `json:"number_phone"`
	TelegramChatID string `json:"telegram_chat_id"`
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

	user, err := h.userService.UpdateUser(id, req.Email, req.FullName, req.NumberPhone, req.TelegramChatID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

type AssignLeaderRequest struct {
	LeaderID string `json:"leader_id"`
}

func (h *UserHandler) AssignLeader(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	var req AssignLeaderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	if err := h.userService.AssignLeader(id, req.LeaderID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign leader", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Leader assigned successfully"})
}

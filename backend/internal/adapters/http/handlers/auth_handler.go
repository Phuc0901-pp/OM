package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/core/errors"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain/dtos"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Register godoc
// @Summary      Register a new user
// @Description  Create a new user account with email and password
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body dtos.RegisterRequest true "Register Request"
// @Success      201  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Router       /users [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req dtos.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errors.ErrValidation) // Use global error handler
		return
	}

	err := h.authService.Register(req.Email, req.Password, req.FullName)
	if err != nil {
		c.Error(errors.NewAppError(400, err.Error(), http.StatusBadRequest)) // Wrap service error
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User registered successfully"})
}

// Login godoc
// @Summary      Login
// @Description  Authenticate user and return JWT token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body dtos.LoginRequest true "Login Request"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Router       /users/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req dtos.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
        // We can pass the validation error message too if we want detalied feedback
		c.Error(errors.NewAppError(1006, "Invalid input: "+err.Error(), http.StatusBadRequest))
		return
	}

	token, user, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		c.Error(errors.ErrUnauthorized)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   token,
		"user": gin.H{
			"id":        user.ID,
			"email":     user.Email,
			"full_name": user.FullName,
			"role":      user.Role,
		},
	})
}

// Logout godoc
// @Summary      Logout
// @Description  Logout user (client should delete token)
// @Tags         auth
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]string
// @Router       /users/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

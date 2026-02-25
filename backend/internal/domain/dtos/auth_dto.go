package dtos

// RegisterRequest represents the data needed for registration
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FullName string `json:"full_name" binding:"required"`
}

// LoginRequest represents the data needed for login
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse represents the success response for login/register
type AuthResponse struct {
	Token   string `json:"token"`
	Message string `json:"message,omitempty"`
}

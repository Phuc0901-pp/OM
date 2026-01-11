package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/adapters/storage/postgres"
	"github.com/phuc/cmms-backend/internal/domain"
)

type RoleHandler struct {
	Repo postgres.RoleRepository
}

func NewRoleHandler(repo postgres.RoleRepository) *RoleHandler {
	return &RoleHandler{Repo: repo}
}

func (h *RoleHandler) GetAllRoles(c *gin.Context) {
	roles, err := h.Repo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch roles"})
		return
	}
	c.JSON(http.StatusOK, roles)
}

func (h *RoleHandler) CreateRole(c *gin.Context) {
	var role domain.Role
	if err := c.ShouldBindJSON(&role); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.Repo.Create(&role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
		return
	}
	c.JSON(http.StatusCreated, role)
}

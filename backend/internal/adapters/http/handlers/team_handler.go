package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/adapters/storage/postgres"
	"github.com/phuc/cmms-backend/internal/domain"
)

type TeamHandler struct {
	Repo postgres.TeamRepository
}

func NewTeamHandler(repo postgres.TeamRepository) *TeamHandler {
	return &TeamHandler{Repo: repo}
}

func (h *TeamHandler) GetAllTeams(c *gin.Context) {
	teams, err := h.Repo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teams"})
		return
	}
	c.JSON(http.StatusOK, teams)
}

func (h *TeamHandler) CreateTeam(c *gin.Context) {
	var team domain.Team
	if err := c.ShouldBindJSON(&team); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Auto-generate Character (Acronym) from Name
	if team.Name != "" {
		words := strings.Fields(team.Name)
		var acronym strings.Builder
		for _, word := range words {
			if len(word) > 0 {
				acronym.WriteByte(word[0])
			}
		}
		team.Character = strings.ToUpper(acronym.String())
	}

	if err := h.Repo.Create(&team); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create team"})
		return
	}
	c.JSON(http.StatusCreated, team)
}

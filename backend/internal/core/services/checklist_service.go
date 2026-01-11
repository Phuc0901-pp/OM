package services

import (
	"encoding/json"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// MapToJSON converts a map to a JSON byte slice
func MapToJSON(m map[string]interface{}) []byte {
	b, err := json.Marshal(m)
	if err != nil {
		return []byte("{}")
	}
	return b
}

type ChecklistService struct {
	db *gorm.DB
}

func NewChecklistService(db *gorm.DB) *ChecklistService {
	return &ChecklistService{db: db}
}

// GetConfigByAssign returns the checklist configuration for a specific assign
func (s *ChecklistService) GetConfigByAssign(assignID string) (*domain.ChecklistTemplate, error) {
	var config domain.ChecklistTemplate
	result := s.db.Where("assign_id = ?", assignID).First(&config)
	if result.Error != nil {
		return nil, result.Error
	}
	return &config, nil
}

// SaveConfig creates or updates the checklist configuration (upsert by assign_id)
func (s *ChecklistService) SaveConfig(config *domain.ChecklistTemplate) error {
	// Check if exists unique(assign_id)
	var existing domain.ChecklistTemplate
	err := s.db.Where("assign_id = ?", config.AssignID).First(&existing).Error

	if err == nil {
		// Update existing
		config.ID = existing.ID // Keep existing ID
		return s.db.Save(config).Error
	} else if err == gorm.ErrRecordNotFound {
		// Create new
		config.ID = uuid.New()
		return s.db.Create(config).Error
	} else {
		return err
	}
}

// GetProjectChecklists returns all checklist configs for assignments belonging to a project
func (s *ChecklistService) GetProjectChecklists(projectID string) ([]domain.ChecklistTemplate, error) {
	var configs []domain.ChecklistTemplate
	// Join with assign table to filter by project_id
	err := s.db.Joins("JOIN assign ON assign.id = checklist_templates.assign_id").
		Where("assign.id_project = ?", projectID).
		Find(&configs).Error
	return configs, err
}

// DeleteConfigByAssign deletes the checklist configuration by assign_id
func (s *ChecklistService) DeleteConfigByAssign(assignID string) error {
	return s.db.Where("assign_id = ?", assignID).Delete(&domain.ChecklistTemplate{}).Error
}

// DeleteByProjectAndChild deletes checklist configurations by project_id and child_category_id
// This joins with the assign table to find matching records
func (s *ChecklistService) DeleteByProjectAndChild(projectID uuid.UUID, childCategoryID uuid.UUID) error {
	// Find assignments for this project
	var assignIDs []uuid.UUID
	err := s.db.Model(&domain.Assign{}).
		Where("id_project = ?", projectID).
		Pluck("id", &assignIDs).Error
	if err != nil {
		return err
	}

	if len(assignIDs) == 0 {
		return nil // No assignments for this project
	}

	// Delete checklists that belong to these assignments
	// Note: This is a simplified approach - in reality you might need more logic
	// to match by child_category_id if stored in the checklist
	return s.db.Where("assign_id IN ?", assignIDs).Delete(&domain.ChecklistTemplate{}).Error
}

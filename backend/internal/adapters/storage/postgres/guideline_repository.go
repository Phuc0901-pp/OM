package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type guideLineRepository struct{ db *gorm.DB }

func NewGuideLineRepository(db *gorm.DB) domain.GuideLineRepository {
	return &guideLineRepository{db: db}
}

// FindBySubWorkID returns the guideline for a given sub-work, or nil if not found
func (r *guideLineRepository) FindBySubWorkID(subWorkID uuid.UUID) (*domain.GuideLine, error) {
	var g domain.GuideLine
	err := r.db.Where("id_sub_work = ?", subWorkID).First(&g).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &g, nil
}

// Save creates or updates a guideline (upsert by id_sub_work)
func (r *guideLineRepository) Save(g *domain.GuideLine) error {
	existing, err := r.FindBySubWorkID(g.SubWorkID)
	if err != nil {
		return err
	}
	if existing == nil {
		// New record
		if g.ID == uuid.Nil {
			g.ID = uuid.New()
		}
		return r.db.Create(g).Error
	}
	// Update existing
	existing.GuideText = g.GuideText
	existing.GuideImages = g.GuideImages
	existing.GuideURL = g.GuideURL
	return r.db.Save(existing).Error
}

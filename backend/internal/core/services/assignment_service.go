package services

import (
	"github.com/phuc/cmms-backend/internal/domain"
)

// AssignmentService handles business logic around Assigns and DetailAssigns
type AssignmentService struct {
	assignRepo       domain.AssignRepository
	detailAssignRepo domain.DetailAssignRepository
}

func NewAssignmentService(assignRepo domain.AssignRepository, detailAssignRepo domain.DetailAssignRepository) *AssignmentService {
	return &AssignmentService{
		assignRepo:       assignRepo,
		detailAssignRepo: detailAssignRepo,
	}
}

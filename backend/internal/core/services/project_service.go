package services

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
)

// ProjectService handles project/owner business logic
type ProjectService struct {
	projectRepo domain.ProjectRepository
	ownerRepo   domain.OwnerRepository
}

func NewProjectService(projectRepo domain.ProjectRepository, ownerRepo domain.OwnerRepository) *ProjectService {
	return &ProjectService{
		projectRepo: projectRepo,
		ownerRepo:   ownerRepo,
	}
}

func (s *ProjectService) GetAllProjects() ([]domain.Project, error) {
	return s.projectRepo.FindAll()
}

func (s *ProjectService) GetProjectByID(id uuid.UUID) (*domain.Project, error) {
	return s.projectRepo.FindByID(id)
}

func (s *ProjectService) CreateProject(project *domain.Project) error {
	return s.projectRepo.Create(project)
}

func (s *ProjectService) UpdateProject(project *domain.Project) error {
	return s.projectRepo.Update(project)
}

func (s *ProjectService) DeleteProject(id uuid.UUID) error {
	return s.projectRepo.Delete(id)
}

func (s *ProjectService) GetAllOwners() ([]domain.Owner, error) {
	return s.ownerRepo.FindAll()
}

func (s *ProjectService) CreateOwner(owner *domain.Owner) error {
	return s.ownerRepo.Create(owner)
}

func (s *ProjectService) DeleteOwner(id uuid.UUID) error {
	return s.ownerRepo.Delete(id)
}

package services

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/datatypes"
)

type ProjectService struct {
	repo domain.ProjectRepository
}

func NewProjectService(repo domain.ProjectRepository) *ProjectService {
	return &ProjectService{
		repo: repo,
	}
}

// toSnakeCase converts a string to snake_case
func (s *ProjectService) toSnakeCase(str string) string {
	str = strings.ToLower(str)
	re := regexp.MustCompile(`[^a-z0-9]+`)
	str = re.ReplaceAllString(str, "_")
	str = strings.Trim(str, "_")
	return str
}

func (s *ProjectService) GetAllProjects() ([]domain.Project, error) {
	return s.repo.GetAllProjects()
}

func (s *ProjectService) GetProjectClassifications() ([]domain.ProjectClassification, error) {
	return s.repo.GetAllClassifications()
}

func (s *ProjectService) GetAllMainCategories() ([]domain.MainCategory, error) {
	return s.repo.GetAllMainCategories()
}

func (s *ProjectService) GetChildCategoriesByMainID(idStr string) ([]domain.ChildCategory, error) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil, errors.New("invalid ID")
	}
	return s.repo.GetChildCategoriesByMainID(id)
}

func (s *ProjectService) GetProjectByID(idStr string) (*domain.Project, error) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil, errors.New("invalid Project ID")
	}
	project, err := s.repo.GetProjectByID(id)
	if err != nil {
		return nil, errors.New("project not found")
	}
	return project, nil
}

func (s *ProjectService) GetProjectsByUserID(userIDStr string) ([]domain.Project, error) {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, errors.New("invalid User ID")
	}
	return s.repo.GetProjectsByUserID(userID)
}

func (s *ProjectService) CreateProject(req *domain.Project) error {
	if req.ProjectName == "" {
		return errors.New("project Name is required")
	}
	if req.ID == uuid.Nil {
		req.ID = uuid.New()
	}
	return s.repo.CreateProject(req)
}

func (s *ProjectService) UpdateProject(idStr string, req *domain.Project) error {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return errors.New("invalid Project ID")
	}
	req.ID = id
	return s.repo.UpdateProject(req)
}

func (s *ProjectService) CreateMainCategory(req *domain.MainCategory) error {
	if req.Name == "" {
		return errors.New("name is required")
	}
	return s.repo.CreateMainCategory(req)
}

func (s *ProjectService) CreateChildCategory(req *domain.ChildCategory) error {
	if req.Name == "" {
		return errors.New("name is required")
	}
	if req.MainCategoryID == uuid.Nil && req.StationID == nil {
		return errors.New("either MainCategoryID or StationID is required")
	}

	req.ColumnKey = s.toSnakeCase(req.Name)
	return s.repo.CreateChildCategory(req)
}

func (s *ProjectService) UpdateChildCategory(idStr string, req struct {
	Name             string  `json:"name"`
	RequiresInverter *bool   `json:"requires_inverter"`
	StationID        *string `json:"station_id"`
}) error {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return errors.New("invalid Child Category ID")
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
		updates["column_key"] = s.toSnakeCase(req.Name)
	}
	if req.RequiresInverter != nil {
		updates["requires_inverter"] = *req.RequiresInverter
	}
	if req.StationID != nil {
		if *req.StationID == "" {
			updates["id_station"] = nil
		} else {
			stationUUID, err := uuid.Parse(*req.StationID)
			if err == nil {
				updates["id_station"] = stationUUID
			}
		}
	}

	return s.repo.UpdateChildCategory(id, updates)
}

func (s *ProjectService) GetChildCategoriesByStationID(idStr string) ([]domain.ChildCategory, error) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil, errors.New("invalid Station ID")
	}
	return s.repo.GetChildCategoriesByStationID(id)
}

func (s *ProjectService) GetProjectCharacteristics(idStr string) (*domain.ProjectCharacteristic, error) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil, errors.New("invalid Project ID")
	}
	return s.repo.GetProjectCharacteristic(id)
}

func (s *ProjectService) UpdateProjectCharacteristics(idStr string, req map[string]interface{}) (*domain.ProjectCharacteristic, error) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil, errors.New("invalid Project ID")
	}

	existing, _ := s.repo.GetProjectCharacteristic(id)
	if existing == nil {
		existing = &domain.ProjectCharacteristic{
			ProjectID: id,
		}
	}

	existingData := make(map[string]interface{})
	if existing.ChildCategoryData != nil {
		json.Unmarshal(existing.ChildCategoryData, &existingData)
	}

	for key, value := range req {
		switch key {
		case "inverter_sub_area_count":
			if v, ok := value.(float64); ok {
				existing.InverterSubAreaCount = int(v)
			}
		case "inverter":
			if v, ok := value.(float64); ok {
				existing.Inverter = int(v)
			}
		case "inverter_details":
			if bytes, err := json.Marshal(value); err == nil {
				existing.InverterDetails = bytes
			}
		default:
			existingData[key] = value
		}
	}

	if dataBytes, err := json.Marshal(existingData); err == nil {
		existing.ChildCategoryData = datatypes.JSON(dataBytes)
	}

	if err := s.repo.UpdateProjectCharacteristic(id, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *ProjectService) DeleteProject(idStr string) error {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return errors.New("invalid Project ID")
	}
	return s.repo.DeleteProject(id)
}

func (s *ProjectService) DeleteMainCategory(idStr string) error {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return errors.New("invalid Main Category ID")
	}
	return s.repo.DeleteMainCategory(id)
}

func (s *ProjectService) DeleteChildCategory(idStr string) error {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return errors.New("invalid Child Category ID")
	}
	return s.repo.DeleteChildCategory(id)
}

func (s *ProjectService) CloneProject(idStr string) (*domain.Project, error) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil, errors.New("invalid Project ID")
	}
	return s.repo.CloneProject(id)
}


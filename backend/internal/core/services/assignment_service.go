package services

import (
	"log"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
)

type AssignmentService struct {
	Repo        domain.AllocationRepository // Changed from ProjectRepository
	MinioClient *storage.MinioClient
}

func NewAssignmentService(repo domain.AllocationRepository, minio *storage.MinioClient) *AssignmentService {
	return &AssignmentService{
		Repo:        repo,
		MinioClient: minio,
	}
}

// SyncAllProgress is deprecated (DataWork/DataResult removed)
func (s *AssignmentService) SyncAllProgress() (interface{}, error) {
	return map[string]interface{}{"message": "Sync disabled - DataWork/DataResult removed"}, nil
}

// LinkStationsToAllocation links Stations to an Assignment based on selected StationChildConfigs
// This is the new workflow for allocations (Option B)
func (s *AssignmentService) LinkStationsToAllocation(assignID uuid.UUID, stationChildConfigIDs []uuid.UUID) error {
	if len(stationChildConfigIDs) == 0 {
		return nil
	}

	// 1. Get Station IDs affected by the selected configs
	stationIDs, err := s.Repo.GetStationIDsByChildConfigIDs(stationChildConfigIDs)
	if err != nil {
		log.Printf("LinkStationsToAllocation: Failed to fetch station IDs: %v", err)
		return nil
	}

	// 2. Update AssignID on Stations
	if len(stationIDs) > 0 {
		if err := s.Repo.UpdateStationAssignID(stationIDs, assignID); err != nil {
			log.Printf("LinkStationsToAllocation: Failed to link Stations to Assignment: %v", err)
			return err
		}
	}

	return nil
}

package domain

import (


	"github.com/google/uuid"
)

// AllocationRepository defines methods for managing task assignments
type AllocationRepository interface {
	// Creation
	CreateAssign(a *Assign) error
	
	// Retrieval
	GetAssignByID(id uuid.UUID) (*Assign, error)
	GetAllAssigns() ([]Assign, error)
	GetAssignsByUserID(userID uuid.UUID, projectID *uuid.UUID) ([]Assign, error)
	GetAssignsByProjectID(projectID uuid.UUID) ([]Assign, error)
	CheckProjectExistsInAssign(projectID uuid.UUID) (bool, error)
	
	// Updates
	UpdateStationAssignID(stationIDs []uuid.UUID, assignID uuid.UUID) error
	
	// Deletion (Soft & Hard)
	DeleteAssign(id uuid.UUID) error
	HardDeleteAssign(id uuid.UUID) error
	GetDeletedAssigns() ([]Assign, error)
	GetDeletedAssignsByUsers(userIDs []uuid.UUID) ([]Assign, error)
	RestoreAssign(id uuid.UUID) error

    // Counts
    GetAssignCount() (int64, error)
    GetAssignCountByManagerID(managerID uuid.UUID) (total int64, completed int64, err error)

    // Task & Sync
    SyncTaskDetails(assignID uuid.UUID, details []TaskDetail) error
    UpdateTaskDetailCheck(assignID, childID uuid.UUID, index int, checkStatus int) error
    UpdateTaskDetailStatus(id uuid.UUID, updates map[string]interface{}) error
    UpdateTaskDetailsStatusBulk(ids []uuid.UUID, updates map[string]interface{}) error
    GetStationIDsByChildConfigIDs(configIDs []uuid.UUID) ([]uuid.UUID, error)
}

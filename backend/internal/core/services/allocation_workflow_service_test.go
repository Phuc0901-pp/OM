package services

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/config"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// MockDetailAssignRepository implements domain.DetailAssignRepository for testing
type MockDetailAssignRepository struct {
	Details map[string]*domain.DetailAssign
	UpdateCalled bool
}

func (m *MockDetailAssignRepository) FindByID(id uuid.UUID) (*domain.DetailAssign, error) {
	if d, ok := m.Details[id.String()]; ok {
		return d, nil
	}
	return nil, gorm.ErrRecordNotFound
}
func (m *MockDetailAssignRepository) FindByAssignID(assignID uuid.UUID) ([]domain.DetailAssign, error) {
	return nil, nil
}
func (m *MockDetailAssignRepository) Create(detail *domain.DetailAssign) error { return nil }
func (m *MockDetailAssignRepository) Update(detail *domain.DetailAssign) error {
	m.Details[detail.ID.String()] = detail
	m.UpdateCalled = true
	return nil
}
func (m *MockDetailAssignRepository) Delete(id uuid.UUID) error { return nil }
func (m *MockDetailAssignRepository) GetNamesForMinioPath(id uuid.UUID) (*domain.MinioPathContext, error) {
	return &domain.MinioPathContext{
		ProjectName: "Test Proj",
		WorkName:    "Test Work",
		SubWorkName: "Test Sub",
		AssetName:   "Test Asset",
	}, nil
}
func (m *MockDetailAssignRepository) CountByDate(start, end time.Time) (int64, error) { return 0, nil }

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test memory db: %v", err)
	}
	db.AutoMigrate(&domain.Assign{}, &domain.User{})
	return db
}

func TestApproveDetail(t *testing.T) {
	db := setupTestDB(t)

	mockRepo := &MockDetailAssignRepository{
		Details: make(map[string]*domain.DetailAssign),
	}
	// No panic broadcast func
	broadcastFn := func(msg []byte) {}

	svc := NewAllocationWorkflowService(db, mockRepo, nil, broadcastFn, config.Config{})

	id := uuid.New()
	mockRepo.Details[id.String()] = &domain.DetailAssign{
		ID:         id,
		AssignID:   uuid.New(),
		ApprovalAt: datatypes.JSON("[]"), // Start empty JSON array
	}

	result, err := svc.ApproveDetail(id, "Good job", "u1", "http://front")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result.StatusApprove != 1 {
		t.Errorf("Expected StatusApprove = 1, got %d", result.StatusApprove)
	}
	if result.StatusReject != 0 {
		t.Errorf("Expected StatusReject = 0, got %d", result.StatusReject)
	}
	if result.NoteApproval != "Good job" {
		t.Errorf("Expected NoteApproval = 'Good job', got '%s'", result.NoteApproval)
	}
	if !mockRepo.UpdateCalled {
		t.Error("Expected repo.Update to be called")
	}

	// Verify timestamp array was appended
	var tsArray []string
	json.Unmarshal(result.ApprovalAt, &tsArray)
	if len(tsArray) != 1 {
		t.Errorf("Expected 1 approval timestamp, got %d", len(tsArray))
	}
}

func TestRejectDetail(t *testing.T) {
	db := setupTestDB(t)

	mockRepo := &MockDetailAssignRepository{
		Details: make(map[string]*domain.DetailAssign),
	}

	svc := NewAllocationWorkflowService(db, mockRepo, nil, func(msg []byte) {}, config.Config{})

	id := uuid.New()
	mockRepo.Details[id.String()] = &domain.DetailAssign{
		ID:         id,
		StatusApprove: 1, // Currently approved
		StatusSubmit:  1,
		RejectedAt:  datatypes.JSON("[]"),
	}

	result, err := svc.RejectDetail(id, "Redo this", "u2", "http://front")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result.StatusReject != 1 {
		t.Errorf("Expected StatusReject = 1, got %d", result.StatusReject)
	}
	if result.StatusApprove != 0 || result.StatusSubmit != 0 {
		t.Errorf("StatusApprove & StatusSubmit should be reset to 0 upon rejection")
	}
	if result.NoteReject != "Redo this" {
		t.Errorf("Expected NoteReject to be recorded")
	}
}

func TestBulkUpdateStatus(t *testing.T) {
	db := setupTestDB(t)
	mockRepo := &MockDetailAssignRepository{
		Details: make(map[string]*domain.DetailAssign),
	}
	
	id1 := uuid.New()
	id2 := uuid.New()
	mockRepo.Details[id1.String()] = &domain.DetailAssign{ID: id1, ApprovalAt: datatypes.JSON("[]")}
	mockRepo.Details[id2.String()] = &domain.DetailAssign{ID: id2, ApprovalAt: datatypes.JSON("[]")}
	
	svc := NewAllocationWorkflowService(db, mockRepo, nil, func(m []byte) {}, config.Config{})
	
	result := svc.BulkUpdateStatus([]string{id1.String(), id2.String(), "invalid-uuid"}, 1, "Bulk ok", "", "")
	
	if result.TotalRequested != 3 {
		t.Errorf("Expected total 3, got %d", result.TotalRequested)
	}
	if result.SuccessCount != 2 {
		t.Errorf("Expected 2 successes, got %d", result.SuccessCount)
	}
	
	if mockRepo.Details[id1.String()].StatusApprove != 1 {
		t.Error("Expected detail 1 to be approved")
	}
}

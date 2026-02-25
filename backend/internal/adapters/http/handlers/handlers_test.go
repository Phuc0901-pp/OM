package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/phuc/cmms-backend/internal/domain"
)

// MockProjectRepository is a mock implementation of domain.ProjectRepository
type MockProjectRepository struct {
	mock.Mock
}

func (m *MockProjectRepository) GetAllProjects() ([]domain.Project, error) {
	args := m.Called()
	return args.Get(0).([]domain.Project), args.Error(1)
}

func (m *MockProjectRepository) GetDeletedAssigns() ([]domain.Assign, error) {
	args := m.Called()
	return args.Get(0).([]domain.Assign), args.Error(1)
}

func (m *MockProjectRepository) UpdateTaskDetailStatus(id uuid.UUID, updates map[string]interface{}) error {
	args := m.Called(id, updates)
	return args.Error(0)
}

func (m *MockProjectRepository) UpdateTaskDetailsStatusBulk(ids []uuid.UUID, updates map[string]interface{}) error {
	args := m.Called(ids, updates)
	return args.Error(0)
}

// Implement other required methods as no-ops for now
func (m *MockProjectRepository) GetAllClassifications() ([]domain.ProjectClassification, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetAllMainCategories() ([]domain.MainCategory, error) { return nil, nil }
func (m *MockProjectRepository) GetClassificationByID(id uuid.UUID) (*domain.ProjectClassification, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetChildCategoriesByMainID(mainID uuid.UUID) ([]domain.ChildCategory, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetProjectByID(id uuid.UUID) (*domain.Project, error) {
	return nil, nil
}
func (m *MockProjectRepository) CreateProject(project *domain.Project) error          { return nil }
func (m *MockProjectRepository) UpdateProject(project *domain.Project) error          { return nil }
func (m *MockProjectRepository) DeleteProject(id uuid.UUID) error                     { return nil }
func (m *MockProjectRepository) CreateMainCategory(cat *domain.MainCategory) error   { return nil }
func (m *MockProjectRepository) UpdateMainCategory(id uuid.UUID, name string) error  { return nil }
func (m *MockProjectRepository) DeleteMainCategory(id uuid.UUID) error               { return nil }
func (m *MockProjectRepository) CreateChildCategory(cat *domain.ChildCategory) error { return nil }
func (m *MockProjectRepository) UpdateChildCategory(id uuid.UUID, updates map[string]interface{}) error {
	return nil
}
func (m *MockProjectRepository) DeleteChildCategory(id uuid.UUID) error { return nil }
func (m *MockProjectRepository) CloneProject(id uuid.UUID) (*domain.Project, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetProjectCharacteristic(projectID uuid.UUID) (*domain.ProjectCharacteristic, error) {
	return nil, nil
}
func (m *MockProjectRepository) CreateCharacteristic(c *domain.ProjectCharacteristic) error { return nil }
func (m *MockProjectRepository) UpdateProjectCharacteristic(projectID uuid.UUID, c *domain.ProjectCharacteristic) error {
	return nil
}
func (m *MockProjectRepository) CreateAssign(assign *domain.Assign) error        { return nil }
func (m *MockProjectRepository) GetAllAssigns() ([]domain.Assign, error)         { return nil, nil }
func (m *MockProjectRepository) GetAssignsByUserID(userID uuid.UUID, projectID *uuid.UUID) ([]domain.Assign, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetAssignByID(id uuid.UUID) (*domain.Assign, error) { return nil, nil }
func (m *MockProjectRepository) DeleteAssign(id uuid.UUID) error                    { return nil }
func (m *MockProjectRepository) HardDeleteAssign(id uuid.UUID) error                { return nil }
func (m *MockProjectRepository) RestoreAssign(id uuid.UUID) error                   { return nil }
func (m *MockProjectRepository) CheckProjectExistsInAssign(projectID uuid.UUID) (bool, error) {
	return false, nil
}
func (m *MockProjectRepository) GetAssignsByProjectID(projectID uuid.UUID) ([]domain.Assign, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetChildCategoriesByStationID(stationID uuid.UUID) ([]domain.ChildCategory, error) {
	return nil, nil
}
func (m *MockProjectRepository) CreateClassification(c *domain.ProjectClassification) error { return nil }
func (m *MockProjectRepository) UpdateTaskDetailCheck(assignID, childID uuid.UUID, index int, checkStatus int) error {
	return nil
}
func (m *MockProjectRepository) GetProjectStatusBreakdown() ([]domain.ProjectStatusStat, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetTeamPerformance() ([]domain.TeamPerformanceStat, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetCategoryDistribution() ([]domain.CategoryStat, error) {
	return nil, nil
}
func (m *MockProjectRepository) SyncTaskDetails(assignID uuid.UUID, details []domain.TaskDetail) error {
	return nil
}
func (m *MockProjectRepository) UpdateStationAssignID(stationIDs []uuid.UUID, assignID uuid.UUID) error {
	return nil
}
func (m *MockProjectRepository) GetStationIDsByChildConfigIDs(configIDs []uuid.UUID) ([]uuid.UUID, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetDetailedStats(projectID string, timeUnit string, userID string) ([]domain.TimeStat, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetUserTaskStats(userID uuid.UUID, projectID *uuid.UUID) (*domain.UserTaskStats, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetWorkTimeline(projectID string, limit int, userID string) ([]domain.TaskDetail, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetDeletedAssignsByUsers(userIDs []uuid.UUID) ([]domain.Assign, error) {
	return nil, nil
}
func (m *MockProjectRepository) GetProjectCount() (int64, error)                                          { return 0, nil }
func (m *MockProjectRepository) GetAssignCount() (int64, error)                                           { return 0, nil }
func (m *MockProjectRepository) GetAssignCountByManagerID(managerID uuid.UUID) (int64, int64, error)     { return 0, 0, nil }
func (m *MockProjectRepository) GetProjectsByUserID(userID uuid.UUID) ([]domain.Project, error)          { return nil, nil }

// ─── MockAllocationRepository ────────────────────────────────────────────────
// Minimal stub that satisfies domain.AllocationRepository for HistoryHandler tests.
type MockAllocationRepository struct {
	mock.Mock
}

func (m *MockAllocationRepository) CreateAssign(a *domain.Assign) error                                  { return nil }
func (m *MockAllocationRepository) GetAssignByID(id uuid.UUID) (*domain.Assign, error)                  { return nil, nil }
func (m *MockAllocationRepository) GetAllAssigns() ([]domain.Assign, error)                             { return nil, nil }
func (m *MockAllocationRepository) GetAssignsByUserID(uid uuid.UUID, pid *uuid.UUID) ([]domain.Assign, error) { return nil, nil }
func (m *MockAllocationRepository) GetAssignsByProjectID(pid uuid.UUID) ([]domain.Assign, error)        { return nil, nil }
func (m *MockAllocationRepository) CheckProjectExistsInAssign(pid uuid.UUID) (bool, error)              { return false, nil }
func (m *MockAllocationRepository) UpdateStationAssignID(sids []uuid.UUID, aid uuid.UUID) error         { return nil }
func (m *MockAllocationRepository) DeleteAssign(id uuid.UUID) error                                     { return nil }
func (m *MockAllocationRepository) HardDeleteAssign(id uuid.UUID) error                                 { return nil }
func (m *MockAllocationRepository) GetDeletedAssigns() ([]domain.Assign, error) {
	args := m.Called()
	return args.Get(0).([]domain.Assign), args.Error(1)
}
func (m *MockAllocationRepository) GetDeletedAssignsByUsers(uids []uuid.UUID) ([]domain.Assign, error)  { return nil, nil }
func (m *MockAllocationRepository) RestoreAssign(id uuid.UUID) error                                    { return nil }
func (m *MockAllocationRepository) GetAssignCount() (int64, error)                                      { return 0, nil }
func (m *MockAllocationRepository) GetAssignCountByManagerID(mid uuid.UUID) (int64, int64, error)       { return 0, 0, nil }
func (m *MockAllocationRepository) SyncTaskDetails(aid uuid.UUID, d []domain.TaskDetail) error         { return nil }
func (m *MockAllocationRepository) UpdateTaskDetailCheck(aid, cid uuid.UUID, idx, status int) error    { return nil }
func (m *MockAllocationRepository) UpdateTaskDetailStatus(id uuid.UUID, u map[string]interface{}) error {
	args := m.Called(id, u)
	return args.Error(0)
}
func (m *MockAllocationRepository) UpdateTaskDetailsStatusBulk(ids []uuid.UUID, u map[string]interface{}) error {
	args := m.Called(ids, u)
	return args.Error(0)
}
func (m *MockAllocationRepository) GetStationIDsByChildConfigIDs(cids []uuid.UUID) ([]uuid.UUID, error) { return nil, nil }

// Setup test router
func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

// ============================================
// HistoryHandler Tests
// ============================================

func TestHistoryHandler_GetHistory_Success(t *testing.T) {
	// Arrange
	mockProjectRepo := new(MockProjectRepository)
	mockAllocRepo   := new(MockAllocationRepository)
	handler := NewHistoryHandler(mockProjectRepo, mockAllocRepo)

	testUser := &domain.User{FullName: "Test User"}
	testProject := &domain.Project{ProjectName: "Test Project", Location: "Test Location"}
	testClass := &domain.ProjectClassification{Name: "Test Class"}

	testAssigns := []domain.Assign{
		{
			ID:             uuid.New(),
			User:           testUser,
			Project:        testProject,
			Classification: testClass,
		},
	}

	mockAllocRepo.On("GetDeletedAssigns").Return(testAssigns, nil)
	mockProjectRepo.On("GetAllProjects").Return([]domain.Project{*testProject}, nil)

	router := setupTestRouter()
	router.GET("/allocations/history", handler.GetHistory)

	// Act
	req, _ := http.NewRequest("GET", "/allocations/history", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Assert
	assert.Equal(t, http.StatusOK, resp.Code)
	mockAllocRepo.AssertExpectations(t)

}

func TestHistoryHandler_GetHistory_EmptyList(t *testing.T) {
	// Arrange
	mockProjectRepo := new(MockProjectRepository)
	mockAllocRepo   := new(MockAllocationRepository)
	handler := NewHistoryHandler(mockProjectRepo, mockAllocRepo)

	mockAllocRepo.On("GetDeletedAssigns").Return([]domain.Assign{}, nil)
	mockProjectRepo.On("GetAllProjects").Return([]domain.Project{}, nil)

	router := setupTestRouter()
	router.GET("/allocations/history", handler.GetHistory)

	// Act
	req, _ := http.NewRequest("GET", "/allocations/history", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Assert
	assert.Equal(t, http.StatusOK, resp.Code)

	var result []interface{}
	json.Unmarshal(resp.Body.Bytes(), &result)
	assert.Empty(t, result)
}

// ============================================
// TaskStatusHandler Tests
// ============================================

func TestTaskStatusHandler_UpdateTaskStatus_Approve(t *testing.T) {
	// Arrange
	mockRepo := new(MockProjectRepository)
	mockAllocRepo2 := new(MockAllocationRepository)
	handler := NewTaskStatusHandler(mockRepo, mockAllocRepo2, nil, nil)

	taskID := uuid.New()
	mockAllocRepo2.On("UpdateTaskDetailStatus", taskID, mock.MatchedBy(func(updates map[string]interface{}) bool {
		return updates["status_approve"] == 1 && updates["status_reject"] == 0
	})).Return(nil)

	router := setupTestRouter()
	router.PUT("/task-details/:id/status", handler.UpdateTaskStatus)

	body := map[string]interface{}{"accept": 1}
	jsonBody, _ := json.Marshal(body)

	// Act
	req, _ := http.NewRequest("PUT", "/task-details/"+taskID.String()+"/status", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Assert
	assert.Equal(t, http.StatusOK, resp.Code)
	mockAllocRepo2.AssertExpectations(t)
}

func TestTaskStatusHandler_UpdateTaskStatus_Reject(t *testing.T) {
	// Arrange
	mockRepo := new(MockProjectRepository)
	mockAllocRepo2 := new(MockAllocationRepository)
	handler := NewTaskStatusHandler(mockRepo, mockAllocRepo2, nil, nil)

	taskID := uuid.New()
	mockAllocRepo2.On("UpdateTaskDetailStatus", taskID, mock.MatchedBy(func(updates map[string]interface{}) bool {
		return updates["status_reject"] == 1 && updates["status_approve"] == 0
	})).Return(nil)

	router := setupTestRouter()
	router.PUT("/task-details/:id/status", handler.UpdateTaskStatus)

	body := map[string]interface{}{"accept": -1}
	jsonBody, _ := json.Marshal(body)

	// Act
	req, _ := http.NewRequest("PUT", "/task-details/"+taskID.String()+"/status", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Assert
	assert.Equal(t, http.StatusOK, resp.Code)
	mockAllocRepo2.AssertExpectations(t)
}

func TestTaskStatusHandler_UpdateTaskStatus_InvalidID(t *testing.T) {
	// Arrange
	mockRepo := new(MockProjectRepository)
	mockAllocRepo2 := new(MockAllocationRepository)
	handler := NewTaskStatusHandler(mockRepo, mockAllocRepo2, nil, nil)

	router := setupTestRouter()
	router.PUT("/task-details/:id/status", handler.UpdateTaskStatus)

	body := map[string]interface{}{"accept": 1}
	jsonBody, _ := json.Marshal(body)

	// Act
	req, _ := http.NewRequest("PUT", "/task-details/invalid-uuid/status", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Assert
	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestTaskStatusHandler_BulkUpdateTaskStatus_Success(t *testing.T) {
	// Arrange
	mockRepo := new(MockProjectRepository)
	mockAllocRepo2 := new(MockAllocationRepository)
	handler := NewTaskStatusHandler(mockRepo, mockAllocRepo2, nil, nil)

	id1 := uuid.New()
	id2 := uuid.New()

	mockAllocRepo2.On("UpdateTaskDetailsStatusBulk", mock.MatchedBy(func(ids []uuid.UUID) bool {
		return len(ids) == 2
	}), mock.Anything).Return(nil)

	router := setupTestRouter()
	router.PUT("/task-details/bulk/status", handler.BulkUpdateTaskStatus)

	body := map[string]interface{}{
		"ids":    []string{id1.String(), id2.String()},
		"accept": 1,
		"note":   "Approved batch",
	}
	jsonBody, _ := json.Marshal(body)

	// Act
	req, _ := http.NewRequest("PUT", "/task-details/bulk/status", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Assert
	assert.Equal(t, http.StatusOK, resp.Code)

	var result map[string]interface{}
	json.Unmarshal(resp.Body.Bytes(), &result)
	assert.Equal(t, float64(2), result["count"])
}

func TestTaskStatusHandler_BulkUpdateTaskStatus_NoIDs(t *testing.T) {
	// Arrange
	mockRepo := new(MockProjectRepository)
	mockAllocRepo2 := new(MockAllocationRepository)
	handler := NewTaskStatusHandler(mockRepo, mockAllocRepo2, nil, nil)

	router := setupTestRouter()
	router.PUT("/task-details/bulk/status", handler.BulkUpdateTaskStatus)

	body := map[string]interface{}{
		"ids":    []string{},
		"accept": 1,
	}
	jsonBody, _ := json.Marshal(body)

	// Act
	req, _ := http.NewRequest("PUT", "/task-details/bulk/status", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Assert
	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

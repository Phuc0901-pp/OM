package services

import (
	"errors"
	"math"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/adapters/storage/postgres"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/domain/dtos"
)

type WorkOrderService struct {
	repo *postgres.WorkOrderRepository
}

func NewWorkOrderService(repo *postgres.WorkOrderRepository) *WorkOrderService {
	return &WorkOrderService{repo: repo}
}

// ListWorkOrders xử lý logic lấy danh sách và map sang DTO
func (s *WorkOrderService) ListWorkOrders(opts dtos.FilterOptions) (*dtos.ListWorkOrdersResponse, error) {
	// 1. Gọi Repository lấy data
	workOrders, total, err := s.repo.ListWorkOrders(opts)
	if err != nil {
		return nil, err
	}

	// 2. Map Domain Models -> DTOs
	var responseRows []dtos.WorkOrderResponse
	for _, wo := range workOrders {
		responseRows = append(responseRows, toWorkOrderDTO(wo))
	}

	// 3. Tính toán pagination metadata
	totalPages := int(math.Ceil(float64(total) / float64(opts.Limit)))

	return &dtos.ListWorkOrdersResponse{
		Data:       responseRows,
		Total:      total,
		Page:       opts.Page,
		Limit:      opts.Limit,
		TotalPages: totalPages,
	}, nil
}

func (s *WorkOrderService) CreateWorkOrder(req dtos.CreateWorkOrderRequest, requesterID uuid.UUID) (*dtos.WorkOrderResponse, error) {
	// 1. Map dữ liệu từ Request (DTO) sang Domain Model
	wo := domain.WorkOrder{
		Title:            req.Title,
		Description:      req.Description,
		Priority:         domain.WorkOrderPriority(req.Priority),
		Status:           domain.StatusOpen, // Mặc định luôn là 'open' khi mới tạo
		RequesterID:      requesterID,       // ID người tạo (lấy từ token sau này)
		AssigneeID:       req.AssigneeID,
		DueDate:          req.DueDate,
		ExpectedStartAt:  req.ExpectedStartAt,
		ExpectedFinishAt: req.ExpectedFinishAt,
		
		// Allocation
		ProjectID:               req.ProjectID,
		ProjectClassificationID: req.ProjectClassificationID,
		MainCategoryID:          req.MainCategoryID,
		ChildCategoryID:         req.ChildCategoryID,
		CharacteristicsData:     req.CharacteristicsData,
	}

	// 2. Gọi Repository để lưu xuống DB
	if err := s.repo.Create(&wo); err != nil {
		return nil, err
	}

	// 3. Chuyển đổi ngược lại sang DTO để trả về cho Client
	resp := toWorkOrderDTO(wo)
	return &resp, nil
}

// UpdateStatus xử lý update status dùng Optimistic Locking
func (s *WorkOrderService) UpdateStatus(id uint, req dtos.UpdateWorkOrderStatusRequest, userID uuid.UUID) error {
	// 1. Validate Basic
	// (Có thể check valid transition ở đây hoặc trong domain method)
	newStatus := domain.WorkOrderStatus(req.Status)
	
	// Create Activity Log DTO
	activity := &domain.WorkOrderActivity{
		WorkOrderID:  id,
		UserID:       userID,
		ActivityType: domain.ActivityStatusChange,
		Comment:      req.Comment,
		NewValue:     domain.AssetMetadata{"status": newStatus},
		// Note: OldValue nên được lấy trước nếu cần strict audit, 
		// nhưng để performance tối ưu, ta có thể chấp nhận log status mới thôi 
		// hoặc fetch trước nếu không ngại thêm 1 query.
		// Ở đây ta ưu tiên Locking an toàn.
	}

	// 2. Call Repo
	err := s.repo.UpdateStatus(id, newStatus, req.Version, activity)
	if err != nil {
		if errors.Is(err, domain.ErrOptimisticLock) {
			return errors.New("data has been modified by another user, please refresh")
		}
		return err
	}

	return nil
}

// Helper: Mapper
func toWorkOrderDTO(wo domain.WorkOrder) dtos.WorkOrderResponse {
	resp := dtos.WorkOrderResponse{
		ID:               wo.ID,
		Title:            wo.Title,
		Description:      wo.Description,
		Status:           string(wo.Status),
		Priority:         string(wo.Priority),
		RequesterID:      wo.RequesterID,
		Version:          wo.Version,
		CreatedAt:        wo.CreatedAt,
		UpdatedAt:        wo.UpdatedAt,
		DueDate:          wo.DueDate,
		ExpectedStartAt:  wo.ExpectedStartAt,
		ExpectedFinishAt: wo.ExpectedFinishAt,
		ActualStartAt:    wo.ActualStartAt,
		ActualFinishAt:   wo.ActualFinishAt,
		CompletedAt:      wo.CompletedAt,
		SLAStatus:        wo.CalculateSLAStatus(),
	}

	// Map Relationships if exist
	if wo.Assignee != nil {
		resp.AssigneeID = wo.AssigneeID
		resp.AssigneeName = wo.Assignee.FullName // Assuming User struct has FullName
	}
	if wo.Requester != nil {
		resp.RequesterName = wo.Requester.FullName
	}

	return resp
}

package postgres

import (
	"strings"

	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/domain/dtos"
	"gorm.io/gorm"
)

type WorkOrderRepository struct {
	db *gorm.DB
}

func NewWorkOrderRepository(db *gorm.DB) *WorkOrderRepository {
	return &WorkOrderRepository{db: db}
}

// ListWorkOrders lấy danh sách Work Orders với Filter, Search và Join tối ưu
func (r *WorkOrderRepository) ListWorkOrders(opts dtos.FilterOptions) ([]domain.WorkOrder, int64, error) {
	var workOrders []domain.WorkOrder
	var total int64

	// 1. Base Query với Preload để tránh N+1
	// Chúng ta Join bảng Assets chỉ để search, còn hiển thị thì Preload
	query := r.db.Model(&domain.WorkOrder{}).
		Preload("Assignee").  // Lấy thông tin người thực hiện (1 query)
		Preload("Requester")  // Lấy người yêu cầu (1 query)

	// 2. Dynamic Filtering
	if opts.Status != "" {
		query = query.Where("work_orders.status = ?", opts.Status)
	}

	if opts.Priority != "" {
		query = query.Where("work_orders.priority = ?", opts.Priority)
	}

	// 3. Advanced Search (Search keyword trong Title HOẶC Asset Name)
	if opts.Search != "" {
		lowerKeyword := "%" + strings.ToLower(opts.Search) + "%"
		
		// Join assets removed
		query = query.Where("LOWER(work_orders.title) LIKE ?", lowerKeyword)
	}

	// 4. Count Total (Trước khi apply limit/offset)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 5. Pagination
	offset := (opts.Page - 1) * opts.Limit
	if err := query.Limit(opts.Limit).Offset(offset).Order("work_orders.created_at DESC").Find(&workOrders).Error; err != nil {
		return nil, 0, err
	}

	return workOrders, total, nil
}

// FindByID lấy chi tiết Work Order
func (r *WorkOrderRepository) FindByID(id uint) (*domain.WorkOrder, error) {
	var wo domain.WorkOrder
	err := r.db.Preload("Assignee").Preload("Requester").Preload("Activities").First(&wo, id).Error
	if err != nil {
		return nil, err
	}
	return &wo, nil
}

// UpdateStatus cập nhật trạng thái với Optimistic Locking & Transaction
func (r *WorkOrderRepository) UpdateStatus(id uint, newStatus domain.WorkOrderStatus, version int, activity *domain.WorkOrderActivity) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Optimistic Locking Check & Update
		// Chỉ update nếu ID khớp và Version khớp
		result := tx.Model(&domain.WorkOrder{}).
			Where("id = ? AND version = ?", id, version).
			Updates(map[string]interface{}{
				"status":     newStatus,
				"version":    gorm.Expr("version + 1"), // Tăng version atomatically
				"updated_at": gorm.Expr("NOW()"),
			})

		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected == 0 {
			// Nếu không có dòng nào được update, nghĩa là Version đã bị thay đổi bởi request khác
			return domain.ErrOptimisticLock
		}

		// 2. Insert Audit Log (Activity)
		if activity != nil {
			if err := tx.Create(activity).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// Create: Hàm này chịu trách nhiệm Insert lệnh làm việc mới vào PostgreSQL
func (r *WorkOrderRepository) Create(wo *domain.WorkOrder) error {
	// Gorm sẽ tự động sinh câu lệnh SQL: INSERT INTO work_orders ...
	return r.db.Create(wo).Error
}

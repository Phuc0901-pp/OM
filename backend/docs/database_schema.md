# Database Schema Design - Assets & Work Orders

## 1. Assets Module (Hierarchy Tree)

### Approach: **Closure Table**
Closure Table cho phép truy vấn nhanh toàn bộ cây con hoặc tất cả cha của một node mà không cần recursive queries.

### SQL Schema

```sql
-- Locations (Nhà máy, Khu vực)
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    geo_lat DECIMAL(10, 8),
    geo_lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_locations_deleted_at ON locations(deleted_at);

-- Assets (Thiết bị)
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location_id INTEGER REFERENCES locations(id),
    qr_code VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'active', -- active, maintenance, down
    metadata JSONB, -- Custom fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_assets_location_id ON assets(location_id);
CREATE INDEX idx_assets_qr_code ON assets(qr_code);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_deleted_at ON assets(deleted_at);
CREATE INDEX idx_assets_metadata ON assets USING GIN(metadata);

-- Asset Closure Table (Lưu tất cả quan hệ cha-con)
CREATE TABLE asset_paths (
    ancestor_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    descendant_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL, -- 0 = chính nó, 1 = con trực tiếp, 2+ = cháu
    PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_asset_paths_ancestor ON asset_paths(ancestor_id);
CREATE INDEX idx_asset_paths_descendant ON asset_paths(descendant_id);
CREATE INDEX idx_asset_paths_depth ON asset_paths(depth);

-- Trigger: Tự động thêm self-reference khi tạo asset mới
CREATE OR REPLACE FUNCTION asset_self_reference()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO asset_paths (ancestor_id, descendant_id, depth)
    VALUES (NEW.id, NEW.id, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_asset_self_reference
AFTER INSERT ON assets
FOR EACH ROW
EXECUTE FUNCTION asset_self_reference();
```

### Golang Structs

```go
package domain

import (
    "time"
    "gorm.io/gorm"
    "database/sql/driver"
    "encoding/json"
)

// Location represents a physical location
type Location struct {
    ID        uint           `gorm:"primaryKey" json:"id"`
    Name      string         `gorm:"not null" json:"name"`
    Address   string         `json:"address"`
    GeoLat    *float64       `json:"geo_lat,omitempty"`
    GeoLng    *float64       `json:"geo_lng,omitempty"`
    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// AssetMetadata is a custom JSONB type
type AssetMetadata map[string]interface{}

// Scan implements sql.Scanner
func (m *AssetMetadata) Scan(value interface{}) error {
    bytes, ok := value.([]byte)
    if !ok {
        return nil
    }
    return json.Unmarshal(bytes, m)
}

// Value implements driver.Valuer
func (m AssetMetadata) Value() (driver.Value, error) {
    return json.Marshal(m)
}

// Asset represents equipment or machinery
type Asset struct {
    ID          uint           `gorm:"primaryKey" json:"id"`
    Name        string         `gorm:"not null" json:"name"`
    Description string         `json:"description"`
    LocationID  *uint          `json:"location_id"`
    Location    *Location      `json:"location,omitempty"`
    QRCode      string         `gorm:"uniqueIndex" json:"qr_code"`
    Status      string         `gorm:"default:active" json:"status"` // active, maintenance, down
    Metadata    AssetMetadata  `gorm:"type:jsonb" json:"metadata"`
    CreatedAt   time.Time      `json:"created_at"`
    UpdatedAt   time.Time      `json:"updated_at"`
    DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// AssetPath represents the closure table for asset hierarchy
type AssetPath struct {
    AncestorID   uint `gorm:"primaryKey;not null" json:"ancestor_id"`
    DescendantID uint `gorm:"primaryKey;not null" json:"descendant_id"`
    Depth        int  `gorm:"not null" json:"depth"`
}

// TableName overrides the table name
func (AssetPath) TableName() string {
    return "asset_paths"
}
```

### Queries Thường Dùng

```go
// 1. Lấy tất cả con của một asset (toàn bộ cây con)
func GetAllDescendants(db *gorm.DB, assetID uint) ([]Asset, error) {
    var assets []Asset
    err := db.
        Joins("JOIN asset_paths ON assets.id = asset_paths.descendant_id").
        Where("asset_paths.ancestor_id = ? AND asset_paths.depth > 0", assetID).
        Find(&assets).Error
    return assets, err
}

// 2. Lấy con trực tiếp (depth = 1)
func GetDirectChildren(db *gorm.DB, assetID uint) ([]Asset, error) {
    var assets []Asset
    err := db.
        Joins("JOIN asset_paths ON assets.id = asset_paths.descendant_id").
        Where("asset_paths.ancestor_id = ? AND asset_paths.depth = 1", assetID).
        Find(&assets).Error
    return assets, err
}

// 3. Lấy tất cả cha (path to root)
func GetAllAncestors(db *gorm.DB, assetID uint) ([]Asset, error) {
    var assets []Asset
    err := db.
        Joins("JOIN asset_paths ON assets.id = asset_paths.ancestor_id").
        Where("asset_paths.descendant_id = ? AND asset_paths.depth > 0", assetID).
        Order("asset_paths.depth DESC").
        Find(&assets).Error
    return assets, err
}

// 4. Thêm asset con
func AddChildAsset(db *gorm.DB, parentID uint, child *Asset) error {
    return db.Transaction(func(tx *gorm.DB) error {
        // Create asset
        if err := tx.Create(child).Error; err != nil {
            return err
        }
        
        // Copy all paths from parent and add new paths
        var paths []AssetPath
        if err := tx.Where("descendant_id = ?", parentID).Find(&paths).Error; err != nil {
            return err
        }
        
        for _, path := range paths {
            newPath := AssetPath{
                AncestorID:   path.AncestorID,
                DescendantID: child.ID,
                Depth:        path.Depth + 1,
            }
            if err := tx.Create(&newPath).Error; err != nil {
                return err
            }
        }
        
        return nil
    })
}
```

---

## 2. Work Orders Module (Audit Log)

### SQL Schema

```sql
-- Work Orders
CREATE TABLE work_orders (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    asset_id INTEGER REFERENCES assets(id),
    requester_id INTEGER NOT NULL REFERENCES users(id),
    assignee_id INTEGER REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, on_hold, completed, cancelled
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    steps_data JSONB, -- Runtime state of checklist execution
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_work_orders_asset_id ON work_orders(asset_id);
CREATE INDEX idx_work_orders_requester_id ON work_orders(requester_id);
CREATE INDEX idx_work_orders_assignee_id ON work_orders(assignee_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_priority ON work_orders(priority);
CREATE INDEX idx_work_orders_due_date ON work_orders(due_date);
CREATE INDEX idx_work_orders_deleted_at ON work_orders(deleted_at);
CREATE INDEX idx_work_orders_steps_data ON work_orders USING GIN(steps_data);

-- Work Order Activities (Audit Log)
CREATE TABLE work_order_activities (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    activity_type VARCHAR(50) NOT NULL, -- status_change, comment, attachment, assignment, field_update
    old_value TEXT,
    new_value TEXT,
    comment TEXT,
    metadata JSONB, -- Additional data (file URLs, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wo_activities_work_order_id ON work_order_activities(work_order_id);
CREATE INDEX idx_wo_activities_user_id ON work_order_activities(user_id);
CREATE INDEX idx_wo_activities_type ON work_order_activities(activity_type);
CREATE INDEX idx_wo_activities_created_at ON work_order_activities(created_at);

-- Trigger: Auto-log status changes
CREATE OR REPLACE FUNCTION log_work_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO work_order_activities (
            work_order_id, 
            user_id, 
            activity_type, 
            old_value, 
            new_value
        ) VALUES (
            NEW.id,
            COALESCE(NEW.assignee_id, NEW.requester_id),
            'status_change',
            OLD.status,
            NEW.status
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_wo_status_change
AFTER UPDATE ON work_orders
FOR EACH ROW
EXECUTE FUNCTION log_work_order_status_change();
```

### Golang Structs

```go
package domain

import (
    "time"
    "gorm.io/gorm"
)

type WorkOrderPriority string
type WorkOrderStatus string

const (
    PriorityLow    WorkOrderPriority = "low"
    PriorityMedium WorkOrderPriority = "medium"
    PriorityHigh   WorkOrderPriority = "high"
)

const (
    StatusOpen       WorkOrderStatus = "open"
    StatusInProgress WorkOrderStatus = "in_progress"
    StatusOnHold     WorkOrderStatus = "on_hold"
    StatusCompleted  WorkOrderStatus = "completed"
    StatusCancelled  WorkOrderStatus = "cancelled"
)

// WorkOrder represents a maintenance task
type WorkOrder struct {
    ID          uint                `gorm:"primaryKey" json:"id"`
    Title       string              `gorm:"not null" json:"title"`
    Description string              `json:"description"`
    AssetID     *uint               `json:"asset_id"`
    Asset       *Asset              `json:"asset,omitempty"`
    RequesterID uint                `gorm:"not null" json:"requester_id"`
    Requester   *User               `json:"requester,omitempty"`
    AssigneeID  *uint               `json:"assignee_id"`
    Assignee    *User               `json:"assignee,omitempty"`
    Priority    WorkOrderPriority   `gorm:"default:medium" json:"priority"`
    Status      WorkOrderStatus     `gorm:"default:open" json:"status"`
    DueDate     *time.Time          `json:"due_date,omitempty"`
    CompletedAt *time.Time          `json:"completed_at,omitempty"`
    StepsData   AssetMetadata       `gorm:"type:jsonb" json:"steps_data"` // Reuse JSONB type
    Activities  []WorkOrderActivity `json:"activities,omitempty"`
    CreatedAt   time.Time           `json:"created_at"`
    UpdatedAt   time.Time           `json:"updated_at"`
    DeletedAt   gorm.DeletedAt      `gorm:"index" json:"-"`
}

type ActivityType string

const (
    ActivityStatusChange ActivityType = "status_change"
    ActivityComment      ActivityType = "comment"
    ActivityAttachment   ActivityType = "attachment"
    ActivityAssignment   ActivityType = "assignment"
    ActivityFieldUpdate  ActivityType = "field_update"
)

// WorkOrderActivity represents audit log entries
type WorkOrderActivity struct {
    ID           uint          `gorm:"primaryKey" json:"id"`
    WorkOrderID  uint          `gorm:"not null" json:"work_order_id"`
    UserID       uint          `gorm:"not null" json:"user_id"`
    User         *User         `json:"user,omitempty"`
    ActivityType ActivityType  `gorm:"not null" json:"activity_type"`
    OldValue     string        `json:"old_value,omitempty"`
    NewValue     string        `json:"new_value,omitempty"`
    Comment      string        `json:"comment,omitempty"`
    Metadata     AssetMetadata `gorm:"type:jsonb" json:"metadata,omitempty"`
    CreatedAt    time.Time     `json:"created_at"`
}

// TableName overrides the table name
func (WorkOrderActivity) TableName() string {
    return "work_order_activities"
}
```

### Service Methods for Audit Logging

```go
package services

import (
    "github.com/phuc/cmms-backend/internal/domain"
    "gorm.io/gorm"
)

type WorkOrderService struct {
    db *gorm.DB
}

// UpdateStatus with automatic audit logging
func (s *WorkOrderService) UpdateStatus(woID uint, userID uint, newStatus domain.WorkOrderStatus, comment string) error {
    return s.db.Transaction(func(tx *gorm.DB) error {
        var wo domain.WorkOrder
        if err := tx.First(&wo, woID).Error; err != nil {
            return err
        }
        
        oldStatus := wo.Status
        wo.Status = newStatus
        
        if err := tx.Save(&wo).Error; err != nil {
            return err
        }
        
        // Manual log if needed (trigger already logs status_change)
        if comment != "" {
            activity := domain.WorkOrderActivity{
                WorkOrderID:  woID,
                UserID:       userID,
                ActivityType: domain.ActivityComment,
                Comment:      comment,
            }
            if err := tx.Create(&activity).Error; err != nil {
                return err
            }
        }
        
        return nil
    })
}

// AddComment
func (s *WorkOrderService) AddComment(woID uint, userID uint, comment string) error {
    activity := domain.WorkOrderActivity{
        WorkOrderID:  woID,
        UserID:       userID,
        ActivityType: domain.ActivityComment,
        Comment:      comment,
    }
    return s.db.Create(&activity).Error
}

// GetActivityLog
func (s *WorkOrderService) GetActivityLog(woID uint) ([]domain.WorkOrderActivity, error) {
    var activities []domain.WorkOrderActivity
    err := s.db.
        Preload("User").
        Where("work_order_id = ?", woID).
        Order("created_at DESC").
        Find(&activities).Error
    return activities, err
}
```

---

## 3. Migration Integration

Update `internal/platform/database/postgres.go`:

```go
func Connect() {
    // ... existing code ...
    
    log.Println("Running Auto Migrations...")
    err = DB.AutoMigrate(
        &domain.User{},
        &domain.Team{},
        &domain.Location{},
        &domain.Asset{},
        &domain.AssetPath{},
        &domain.WorkOrder{},
        &domain.WorkOrderActivity{},
    )
    if err != nil {
        log.Fatal("Failed to migrate database: ", err)
    }
    log.Println("Database migrated successfully")
}
```

---

## Summary

### Assets (Closure Table)
- ✅ **Fast queries**: Lấy toàn bộ cây con hoặc cha chỉ với 1 JOIN
- ✅ **Scalable**: Không cần recursive CTE
- ✅ **Trade-off**: Tốn storage (O(n²) worst case), nhưng đáng giá cho read-heavy workload

### Work Orders (Audit Log)
- ✅ **Complete history**: Mọi thay đổi đều được log
- ✅ **Automatic**: Trigger tự động log status changes
- ✅ **Flexible**: JSONB metadata cho custom data
- ✅ **Queryable**: Index trên activity_type và created_at

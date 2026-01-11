# Work Order API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Endpoints

### 1. Create Work Order
**POST** `/work-orders`

Tạo lệnh làm việc mới với validation đầy đủ.

**Request Body:**
```json
{
  "title": "Bảo trì máy nén khí số 3",
  "description": "Kiểm tra và thay dầu máy nén",
  "asset_id": 5,
  "assignee_id": 2,
  "priority": "high",
  "due_date": "2025-12-15T10:00:00Z"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "title": "Bảo trì máy nén khí số 3",
  "description": "Kiểm tra và thay dầu máy nén",
  "asset_id": 5,
  "asset": {
    "id": 5,
    "name": "Máy nén khí Atlas Copco"
  },
  "requester_id": 1,
  "requester": {
    "id": 1,
    "email": "admin@example.com",
    "full_name": "Admin User"
  },
  "assignee_id": 2,
  "assignee": {
    "id": 2,
    "email": "engineer@example.com",
    "full_name": "Kỹ sư A"
  },
  "priority": "high",
  "status": "open",
  "due_date": "2025-12-15T10:00:00Z",
  "created_at": "2025-12-08T22:50:00Z",
  "updated_at": "2025-12-08T22:50:00Z"
}
```

**Validation Rules:**
- `title`: Required, không được rỗng
- `priority`: Mặc định là `medium` nếu không cung cấp
- `status`: Luôn bắt đầu là `open`

---

### 2. List Work Orders (Pagination & Filters)
**GET** `/work-orders`

Lấy danh sách lệnh làm việc với phân trang và lọc.

**Query Parameters:**
- `page` (int, optional): Số trang (mặc định: 1)
- `page_size` (int, optional): Số items mỗi trang (mặc định: 10, max: 100)
- `status` (string, optional): Lọc theo trạng thái (`open`, `in_progress`, `on_hold`, `completed`, `cancelled`)
- `priority` (string, optional): Lọc theo độ ưu tiên (`low`, `medium`, `high`)

**Example Request:**
```
GET /work-orders?page=1&page_size=20&status=open&priority=high
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Bảo trì máy nén khí số 3",
      "status": "open",
      "priority": "high",
      "asset": { ... },
      "requester": { ... },
      "assignee": { ... },
      "created_at": "2025-12-08T22:50:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

---

### 3. Get Work Order by ID
**GET** `/work-orders/:id`

Lấy chi tiết một lệnh làm việc cụ thể.

**Example Request:**
```
GET /work-orders/1
```

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "Bảo trì máy nén khí số 3",
  "description": "Kiểm tra và thay dầu máy nén",
  "asset": { ... },
  "requester": { ... },
  "assignee": { ... },
  "priority": "high",
  "status": "open",
  "activities": [
    {
      "id": 1,
      "activity_type": "status_change",
      "old_value": "open",
      "new_value": "in_progress",
      "user": { ... },
      "created_at": "2025-12-08T23:00:00Z"
    }
  ]
}
```

---

### 4. Update Work Order Status
**PUT** `/work-orders/:id/status`

Cập nhật trạng thái của lệnh làm việc. Tự động log vào audit trail.

**Request Body:**
```json
{
  "status": "in_progress",
  "comment": "Đã bắt đầu kiểm tra máy nén"
}
```

**Valid Statuses:**
- `open`
- `in_progress`
- `on_hold`
- `completed`
- `cancelled`

**Response (200 OK):**
```json
{
  "message": "Status updated successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "status is already in_progress"
}
```

**Business Logic:**
- Kiểm tra status có hợp lệ không
- Không cho phép update nếu status giống cũ
- Tự động set `completed_at` khi status = `completed`
- Tự động log activity vào database (trigger + manual)
- Nếu có `comment`, tạo thêm activity type `comment`

---

### 5. Get Activity Log
**GET** `/work-orders/:id/activities`

Lấy toàn bộ lịch sử thay đổi (audit log) của một work order.

**Example Request:**
```
GET /work-orders/1/activities
```

**Response (200 OK):**
```json
[
  {
    "id": 3,
    "work_order_id": 1,
    "user_id": 2,
    "user": {
      "id": 2,
      "email": "engineer@example.com",
      "full_name": "Kỹ sư A"
    },
    "activity_type": "comment",
    "comment": "Đã bắt đầu kiểm tra máy nén",
    "created_at": "2025-12-08T23:00:00Z"
  },
  {
    "id": 2,
    "work_order_id": 1,
    "user_id": 2,
    "user": { ... },
    "activity_type": "status_change",
    "old_value": "open",
    "new_value": "in_progress",
    "created_at": "2025-12-08T23:00:00Z"
  },
  {
    "id": 1,
    "work_order_id": 1,
    "user_id": 1,
    "user": { ... },
    "activity_type": "status_change",
    "old_value": null,
    "new_value": "open",
    "created_at": "2025-12-08T22:50:00Z"
  }
]
```

**Activity Types:**
- `status_change`: Thay đổi trạng thái
- `comment`: Comment từ user
- `attachment`: Upload file
- `assignment`: Thay đổi người được giao
- `field_update`: Cập nhật field khác

---

## Error Handling

Tất cả API đều trả về error format chuẩn:

```json
{
  "error": "Mô tả lỗi chi tiết"
}
```

**HTTP Status Codes:**
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Validation error hoặc business logic error
- `404 Not Found`: Resource không tồn tại
- `500 Internal Server Error`: Server error

---

## Testing với cURL

### Create Work Order
```bash
curl -X POST http://localhost:3000/api/v1/work-orders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bảo trì máy nén khí số 3",
    "description": "Kiểm tra và thay dầu máy nén",
    "priority": "high"
  }'
```

### List Work Orders
```bash
curl "http://localhost:3000/api/v1/work-orders?page=1&page_size=10&status=open"
```

### Update Status
```bash
curl -X PUT http://localhost:3000/api/v1/work-orders/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "comment": "Đã bắt đầu kiểm tra"
  }'
```

---

## Architecture

**Controller → Service → Repository Pattern**

```
Handler (work_order_handler.go)
  ↓ Validates HTTP request
  ↓ Parses parameters
Service (work_order_service.go)
  ↓ Business logic
  ↓ Validation rules
Repository (work_order_repository.go)
  ↓ Database queries
  ↓ GORM operations
Database (PostgreSQL)
```

**Key Features:**
- ✅ Pagination với total count
- ✅ Multiple filters (status, priority)
- ✅ Automatic audit logging (trigger + manual)
- ✅ Comprehensive error handling
- ✅ Preloaded relationships (Asset, Requester, Assignee)
- ✅ Comment trong code giải thích logic

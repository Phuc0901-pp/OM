# Dynamic Procedure/Checklist System Design

## 1. Tổng Quan

Hệ thống Procedure cho phép tạo các template động với nhiều loại bước kiểm tra khác nhau. Khi thực hiện Work Order, user điền vào form được render từ template này.

## 2. Database Schema

### Procedure Templates Table

```sql
CREATE TABLE procedure_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- maintenance, inspection, repair
    steps JSONB NOT NULL, -- Dynamic steps definition
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_procedure_templates_steps ON procedure_templates USING GIN(steps);
```

### Work Order Steps Data (Runtime State)

Lưu trong `work_orders.steps_data` (JSONB) - đã có sẵn trong schema hiện tại.

---

## 3. JSON Structure Design

### Template Definition (Lưu trong `procedure_templates.steps`)

```json
{
  "version": "1.0",
  "steps": [
    {
      "id": "step_1",
      "order": 1,
      "type": "checkbox",
      "label": "Kiểm tra nguồn điện",
      "required": true,
      "description": "Đảm bảo nguồn điện ổn định 220V"
    },
    {
      "id": "step_2",
      "order": 2,
      "type": "number_input",
      "label": "Đo nhiệt độ dàn lạnh",
      "required": true,
      "unit": "°C",
      "min": -10,
      "max": 30,
      "description": "Nhiệt độ bình thường: 5-10°C"
    },
    {
      "id": "step_3",
      "order": 3,
      "type": "photo_upload",
      "label": "Chụp ảnh dàn nóng",
      "required": true,
      "max_photos": 3,
      "description": "Chụp từ 3 góc độ khác nhau"
    },
    {
      "id": "step_4",
      "order": 4,
      "type": "pass_fail",
      "label": "Kiểm tra gas (áp suất)",
      "required": true,
      "pass_label": "Đạt (14-16 bar)",
      "fail_label": "Không đạt"
    },
    {
      "id": "step_5",
      "order": 5,
      "type": "text_input",
      "label": "Ghi chú bổ sung",
      "required": false,
      "multiline": true,
      "placeholder": "Nhập ghi chú nếu có..."
    }
  ]
}
```

### Runtime Execution Data (Lưu trong `work_orders.steps_data`)

```json
{
  "template_id": 1,
  "template_version": "1.0",
  "started_at": "2025-12-08T10:00:00Z",
  "completed_at": "2025-12-08T10:30:00Z",
  "completed_by": 2,
  "steps": [
    {
      "step_id": "step_1",
      "type": "checkbox",
      "value": true,
      "completed_at": "2025-12-08T10:05:00Z"
    },
    {
      "step_id": "step_2",
      "type": "number_input",
      "value": 7.5,
      "unit": "°C",
      "completed_at": "2025-12-08T10:10:00Z"
    },
    {
      "step_id": "step_3",
      "type": "photo_upload",
      "value": [
        "/uploads/work-orders/123/step3_photo1.jpg",
        "/uploads/work-orders/123/step3_photo2.jpg",
        "/uploads/work-orders/123/step3_photo3.jpg"
      ],
      "completed_at": "2025-12-08T10:20:00Z"
    },
    {
      "step_id": "step_4",
      "type": "pass_fail",
      "value": "pass",
      "completed_at": "2025-12-08T10:25:00Z"
    },
    {
      "step_id": "step_5",
      "type": "text_input",
      "value": "Máy hoạt động tốt, đã vệ sinh dàn lạnh",
      "completed_at": "2025-12-08T10:30:00Z"
    }
  ]
}
```

---

## 4. Ví Dụ: Template Bảo Trì Máy Lạnh

```json
{
  "name": "Bảo trì định kỳ máy lạnh",
  "description": "Quy trình kiểm tra và bảo trì máy lạnh 3 tháng/lần",
  "category": "maintenance",
  "steps": {
    "version": "1.0",
    "steps": [
      {
        "id": "ac_check_power",
        "order": 1,
        "type": "checkbox",
        "label": "Kiểm tra nguồn điện và cầu dao",
        "required": true,
        "description": "Đảm bảo nguồn điện ổn định, cầu dao không bị cháy"
      },
      {
        "id": "ac_measure_temp_cold",
        "order": 2,
        "type": "number_input",
        "label": "Đo nhiệt độ dàn lạnh (evaporator)",
        "required": true,
        "unit": "°C",
        "min": -10,
        "max": 30,
        "description": "Nhiệt độ bình thường: 5-10°C"
      },
      {
        "id": "ac_measure_temp_hot",
        "order": 3,
        "type": "number_input",
        "label": "Đo nhiệt độ dàn nóng (condenser)",
        "required": true,
        "unit": "°C",
        "min": 20,
        "max": 80,
        "description": "Nhiệt độ bình thường: 40-60°C"
      },
      {
        "id": "ac_photo_hot_unit",
        "order": 4,
        "type": "photo_upload",
        "label": "Chụp ảnh dàn nóng",
        "required": true,
        "max_photos": 3,
        "description": "Chụp từ 3 góc: trước, trái, phải"
      },
      {
        "id": "ac_photo_cold_unit",
        "order": 5,
        "type": "photo_upload",
        "label": "Chụp ảnh dàn lạnh",
        "required": true,
        "max_photos": 2,
        "description": "Chụp trước và sau khi vệ sinh"
      },
      {
        "id": "ac_check_gas_pressure",
        "order": 6,
        "type": "pass_fail",
        "label": "Kiểm tra áp suất gas (R410A)",
        "required": true,
        "pass_label": "Đạt (14-16 bar)",
        "fail_label": "Không đạt (cần bơm gas)",
        "description": "Sử dụng đồng hồ đo áp suất"
      },
      {
        "id": "ac_check_filter",
        "order": 7,
        "type": "checkbox",
        "label": "Vệ sinh lưới lọc bụi",
        "required": true,
        "description": "Tháo và vệ sinh lưới lọc"
      },
      {
        "id": "ac_check_drain",
        "order": 8,
        "type": "checkbox",
        "label": "Kiểm tra đường thoát nước",
        "required": true,
        "description": "Đảm bảo nước thoát thông suốt"
      },
      {
        "id": "ac_measure_current",
        "order": 9,
        "type": "number_input",
        "label": "Đo dòng điện compressor",
        "required": false,
        "unit": "A",
        "min": 0,
        "max": 50,
        "description": "Dòng điện bình thường: 3-8A (tùy công suất)"
      },
      {
        "id": "ac_notes",
        "order": 10,
        "type": "text_input",
        "label": "Ghi chú và khuyến nghị",
        "required": false,
        "multiline": true,
        "placeholder": "Ghi chú tình trạng máy, các vấn đề phát hiện..."
      }
    ]
  }
}
```

---

## 5. Step Types Reference

### 5.1. Checkbox
```json
{
  "type": "checkbox",
  "label": "Mô tả công việc",
  "required": true,
  "description": "Hướng dẫn chi tiết"
}
```
**Value khi thực hiện**: `true` hoặc `false`

### 5.2. Number Input
```json
{
  "type": "number_input",
  "label": "Nhập số đo",
  "required": true,
  "unit": "°C",
  "min": 0,
  "max": 100,
  "description": "Giá trị bình thường: 20-30"
}
```
**Value khi thực hiện**: `7.5` (number)

### 5.3. Text Input
```json
{
  "type": "text_input",
  "label": "Nhập văn bản",
  "required": false,
  "multiline": true,
  "placeholder": "Nhập ghi chú..."
}
```
**Value khi thực hiện**: `"Văn bản người dùng nhập"` (string)

### 5.4. Photo Upload
```json
{
  "type": "photo_upload",
  "label": "Chụp ảnh",
  "required": true,
  "max_photos": 3,
  "description": "Chụp từ nhiều góc độ"
}
```
**Value khi thực hiện**: `["/uploads/photo1.jpg", "/uploads/photo2.jpg"]` (array of strings)

### 5.5. Pass/Fail
```json
{
  "type": "pass_fail",
  "label": "Kiểm tra",
  "required": true,
  "pass_label": "Đạt",
  "fail_label": "Không đạt",
  "description": "Tiêu chuẩn đánh giá"
}
```
**Value khi thực hiện**: `"pass"` hoặc `"fail"` (string)

### 5.6. Dropdown (Bonus)
```json
{
  "type": "dropdown",
  "label": "Chọn loại dầu",
  "required": true,
  "options": [
    {"value": "10w40", "label": "10W-40"},
    {"value": "15w40", "label": "15W-40"},
    {"value": "20w50", "label": "20W-50"}
  ]
}
```
**Value khi thực hiện**: `"10w40"` (string)

---

## 6. Golang Domain Models

```go
package domain

import (
    "database/sql/driver"
    "encoding/json"
    "time"
    "gorm.io/gorm"
)

// ProcedureTemplate represents a reusable checklist template
type ProcedureTemplate struct {
    ID          uint           `gorm:"primaryKey" json:"id"`
    Name        string         `gorm:"not null" json:"name"`
    Description string         `json:"description"`
    Category    string         `json:"category"` // maintenance, inspection, repair
    Steps       ProcedureSteps `gorm:"type:jsonb" json:"steps"`
    CreatedBy   uint           `json:"created_by"`
    CreatedAt   time.Time      `json:"created_at"`
    UpdatedAt   time.Time      `json:"updated_at"`
    DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// ProcedureSteps is the JSONB structure for template steps
type ProcedureSteps struct {
    Version string         `json:"version"`
    Steps   []ProcedureStep `json:"steps"`
}

// ProcedureStep defines a single step in the template
type ProcedureStep struct {
    ID          string                 `json:"id"`
    Order       int                    `json:"order"`
    Type        string                 `json:"type"` // checkbox, number_input, text_input, photo_upload, pass_fail
    Label       string                 `json:"label"`
    Required    bool                   `json:"required"`
    Description string                 `json:"description,omitempty"`
    // Type-specific fields
    Unit        string                 `json:"unit,omitempty"`        // for number_input
    Min         *float64               `json:"min,omitempty"`         // for number_input
    Max         *float64               `json:"max,omitempty"`         // for number_input
    MaxPhotos   int                    `json:"max_photos,omitempty"`  // for photo_upload
    PassLabel   string                 `json:"pass_label,omitempty"`  // for pass_fail
    FailLabel   string                 `json:"fail_label,omitempty"`  // for pass_fail
    Multiline   bool                   `json:"multiline,omitempty"`   // for text_input
    Placeholder string                 `json:"placeholder,omitempty"` // for text_input
    Options     []map[string]string    `json:"options,omitempty"`     // for dropdown
}

// Scan implements sql.Scanner
func (ps *ProcedureSteps) Scan(value interface{}) error {
    if value == nil {
        return nil
    }
    bytes, ok := value.([]byte)
    if !ok {
        return nil
    }
    return json.Unmarshal(bytes, ps)
}

// Value implements driver.Valuer
func (ps ProcedureSteps) Value() (driver.Value, error) {
    return json.Marshal(ps)
}
```

---

## 7. Frontend React Component (Dynamic Renderer)

```tsx
// components/DynamicProcedureForm.tsx
import { useState } from 'react';

interface Step {
  id: string;
  order: number;
  type: string;
  label: string;
  required: boolean;
  description?: string;
  unit?: string;
  min?: number;
  max?: number;
  max_photos?: number;
  pass_label?: string;
  fail_label?: string;
  multiline?: boolean;
  placeholder?: string;
}

interface Props {
  steps: Step[];
  onSubmit: (data: any) => void;
}

export default function DynamicProcedureForm({ steps, onSubmit }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  const renderStep = (step: Step) => {
    switch (step.type) {
      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData[step.id] || false}
              onChange={(e) => setFormData({ ...formData, [step.id]: e.target.checked })}
              className="w-4 h-4"
            />
            <span>{step.label}</span>
          </label>
        );

      case 'number_input':
        return (
          <div>
            <label className="block mb-1">{step.label}</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={step.min}
                max={step.max}
                value={formData[step.id] || ''}
                onChange={(e) => setFormData({ ...formData, [step.id]: parseFloat(e.target.value) })}
                className="border px-3 py-2 rounded"
              />
              {step.unit && <span className="self-center">{step.unit}</span>}
            </div>
          </div>
        );

      case 'photo_upload':
        return (
          <div>
            <label className="block mb-1">{step.label}</label>
            <input
              type="file"
              accept="image/*"
              multiple
              max={step.max_photos}
              onChange={(e) => {
                // Handle file upload
                console.log('Files:', e.target.files);
              }}
              className="border px-3 py-2 rounded"
            />
          </div>
        );

      case 'pass_fail':
        return (
          <div>
            <label className="block mb-1">{step.label}</label>
            <div className="flex gap-4">
              <button
                onClick={() => setFormData({ ...formData, [step.id]: 'pass' })}
                className={`px-4 py-2 rounded ${
                  formData[step.id] === 'pass' ? 'bg-green-500 text-white' : 'bg-gray-200'
                }`}
              >
                {step.pass_label || 'Pass'}
              </button>
              <button
                onClick={() => setFormData({ ...formData, [step.id]: 'fail' })}
                className={`px-4 py-2 rounded ${
                  formData[step.id] === 'fail' ? 'bg-red-500 text-white' : 'bg-gray-200'
                }`}
              >
                {step.fail_label || 'Fail'}
              </button>
            </div>
          </div>
        );

      default:
        return <div>Unknown step type: {step.type}</div>;
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      {steps.map((step) => (
        <div key={step.id} className="mb-6 p-4 border rounded">
          <div className="mb-2">
            {renderStep(step)}
            {step.required && <span className="text-red-500 ml-1">*</span>}
          </div>
          {step.description && (
            <p className="text-sm text-gray-500">{step.description}</p>
          )}
        </div>
      ))}
      <button type="submit" className="px-6 py-2 bg-blue-500 text-white rounded">
        Hoàn thành
      </button>
    </form>
  );
}
```

---

## 8. API Endpoints

### Get Procedure Template
```
GET /api/v1/procedures/:id
```

### Create Work Order with Procedure
```
POST /api/v1/work-orders
{
  "title": "Bảo trì máy lạnh phòng A101",
  "procedure_template_id": 1,
  ...
}
```

### Update Step Execution
```
PUT /api/v1/work-orders/:id/steps
{
  "step_id": "ac_measure_temp_cold",
  "value": 7.5,
  "completed_at": "2025-12-08T10:10:00Z"
}
```

---

## 9. Best Practices

1. **Versioning**: Luôn lưu `version` trong template để handle breaking changes
2. **Validation**: Validate `required` fields trước khi submit
3. **Progress Tracking**: Tính % hoàn thành dựa trên số steps đã complete
4. **Photo Storage**: Upload ảnh lên S3/Cloud Storage, chỉ lưu URL trong DB
5. **Audit Trail**: Log mọi thay đổi vào `work_order_activities`

---

## Summary

Cấu trúc JSON này cho phép:
- ✅ Tạo template động với nhiều loại input
- ✅ Render form tự động ở Frontend
- ✅ Lưu trữ hiệu quả trong PostgreSQL JSONB
- ✅ Dễ dàng mở rộng thêm step types mới
- ✅ Track progress và validation

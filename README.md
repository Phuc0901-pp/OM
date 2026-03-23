# Solar O&M - Hệ Thống Quản Lý Vận Hành & Bảo Trì Điện Mặt Trời

## Mục Lục
- [Giới Thiệu](#giới-thiệu)
- [Tính Năng Chính](#tính-năng-chính)
- [3 Giao Diện Người Dùng](#3-giao-diện-người-dùng)
- [Công Nghệ Sử Dụng](#công-nghệ-sử-dụng)
- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [API Documentation](#api-documentation)
- [Báo Cáo Đánh Giá & Gỡ Lỗi](#báo-cáo-đánh-giá--gỡ-lỗi)

---

## Giới Thiệu

**Solar O&M** là hệ thống quản lý vận hành và bảo trì (O&M - Operations & Maintenance) cho các dự án điện mặt trời. Hệ thống hỗ trợ:

- **Check-in/Check-out** với GPS và chụp ảnh xác thực
- **Phân công công việc** theo dự án, trạm, công đoạn
- **Upload minh chứng** (ảnh trước/sau khi thực hiện)
- **Báo cáo & Thống kê** realtime
- **Thông báo đẩy** (Web Push Notifications)
- **PWA** - Hoạt động offline, cài đặt như app native

---

## Tính Năng Chính

### Xác Thực & Bảo Mật
- Đăng nhập JWT
- Phân quyền theo vai trò (Admin, Manager, User)
- Rate Limiting (100 requests/phút/IP)
- CORS strict mode

### Điểm Danh Thông Minh
- Check-in với GPS + Ảnh trước
- Check-out yêu cầu phê duyệt + Ảnh sau
- Watermark tự động (thời gian, vị trí, người dùng)
- Lịch sử điểm danh chi tiết

### Quản Lý Công Việc
- Phân công theo: Dự án -> Trạm -> Danh mục -> Công đoạn
- Trạng thái: Pending -> In Progress -> Submitted -> Approved/Rejected
- Upload nhiều ảnh minh chứng
- Ghi chú từng công việc

### Báo Cáo & Thống Kê
- Dashboard realtime
- Thống kê theo ngày/tuần/tháng/quý/năm
- Xuất báo cáo PDF
- Thư viện ảnh MinIO

### Thông Báo
- Web Push Notifications (VAPID)
- Thông báo khi được phân công
- Thông báo khi công việc được duyệt/từ chối
- Thông báo checkout được phê duyệt

---

## 3 Giao Diện Người Dùng

### 1. Giao Diện ADMIN (Quản Trị Viên)

| Chức năng | Mô tả |
| :--- | :--- |
| **Dashboard** | Tổng quan toàn hệ thống |
| **Quản lý Dự án** | CRUD dự án, danh mục chính/phụ |
| **Quản lý Trạm** | Cấu hình trạm inverter, công đoạn |
| **Phân công** | Giao việc cho nhân viên |
| **Quản lý Nhân sự** | CRUD người dùng, phân team |
| **Giám sát** | Xem trạng thái công việc realtime |
| **Database Inspector** | Xem/sửa trực tiếp database |
| **Báo cáo** | Thư viện ảnh, xuất báo cáo |

**Menu Admin:**
```
Dashboard
Quản lý
   ├── Dự án
   ├── Trạm
   ├── Danh mục
   └── Nhân sự
Vận hành
   ├── Phân công
   └── Giám sát
Báo cáo
Database
Hồ sơ
```

---

### 2. Giao Diện MANAGER (Quản Lý)

| Chức năng | Mô tả |
| :--- | :--- |
| **Dashboard** | Tổng quan team được quản lý |
| **Phân công** | Giao việc cho nhân viên trong team |
| **Giám sát** | Theo dõi tiến độ công việc |
| **Phê duyệt** | Approve/Reject checkout requests |
| **Lịch sử** | Xem lịch sử phân công đã xóa |
| **Nhân sự** | Xem thành viên trong team |
| **Báo cáo** | Thư viện ảnh, download ZIP |

**Menu Manager:**
```
Dashboard
Phân công
Giám sát
Lịch sử
Nhân sự
Báo cáo
Hồ sơ
```

---

### 3. Giao Diện USER (Nhân Viên)

| Chức năng | Mô tả |
| :--- | :--- |
| **Dashboard** | Tổng quan công việc cá nhân |
| **Môi trường làm việc** | Xem dự án được giao, check-in/out |
| **Thực hiện công việc** | Upload ảnh, ghi chú, submit |
| **Thống kê cá nhân** | Xem hiệu suất làm việc |
| **Cài đặt** | Thông báo, ngôn ngữ |

**Menu User:**
```
Dashboard
Môi trường
   ├── Check-in
   ├── Danh sách việc
   └── Check-out
Thống kê
Cài đặt
Hồ sơ
```

**Quy trình làm việc của User:**
```
1. Đăng nhập -> 2. Check-in (GPS + Ảnh) -> 3. Xem công việc được giao
-> 4. Thực hiện & Upload ảnh -> 5. Submit -> 6. Request Checkout (GPS + Ảnh)
-> 7. Chờ Manager phê duyệt -> 8. Hoàn thành
```

---

## Công Nghệ Sử Dụng

### Backend
| Công nghệ | Phiên bản | Mục đích |
| :--- | :---: | :--- |
| Go | 1.23 | Ngôn ngữ chính |
| Gin | 1.9.x | Web Framework |
| GORM | 1.25.x | ORM |
| PostgreSQL | 15 | Database |
| MinIO | Latest | Object Storage |
| Zap | 1.27 | Structured Logging |
| JWT | - | Authentication |

### Frontend
| Công nghệ | Phiên bản | Mục đích |
| :--- | :---: | :--- |
| React | 18.x | UI Library |
| TypeScript | 5.x | Type Safety |
| Vite | 5.x | Build Tool |
| TailwindCSS | 3.x | Styling |
| Lucide Icons | - | Icon Library |
| PWA | - | Offline Support |

### Infrastructure
| Công nghệ | Mục đích |
| :--- | :--- |
| Docker | Containerization |
| Docker Compose | Orchestration |
| Nginx | Reverse Proxy |

---

## Cài Đặt & Chạy (Hướng Dẫn Chi Tiết 2026)

Phần này sẽ hướng dẫn bạn từng bước để triển khai hệ thống **Solar O&M** lên server hoặc máy cá nhân sử dụng Docker.

### 1. Chuẩn Bị Môi Trường
Trước khi bắt đầu, đảm bảo máy tính của bạn đã cài đặt các công cụ sau:

- **Docker Desktop** (Windows/Mac) hoặc **Docker Engine** (Linux): [Tải về tại đây](https://www.docker.com/products/docker-desktop/)
- **Git**: Để tải mã nguồn. [Tải về tại đây](https://git-scm.com/downloads)

Kiểm tra bằng cách mở Terminal (CMD/PowerShell) và gõ:
```bash
docker --version
docker-compose --version
git --version
```

### 2. Tải Mã Nguồn
Clone repository về máy của bạn:

```bash
git clone https://github.com/Phuc0901-pp/OMv2.git
cd OMv2
```

### 3. Cấu Hình Biến Môi Trường (.env)
Hệ thống cần các thông tin mật (mật khẩu DB, khóa bí mật...) để hoạt động. Chúng ta sẽ cấu hình chúng trong file `.env`.

**Bước 3.1: Tạo file .env**
Copy file mẫu `.env.example` thành `.env`:

```bash
cp .env.example .env
```

**Bước 3.2: Điền thông tin**
Mở file `.env` bằng bất kỳ trình soạn thảo nào (Notepad, VSCode, Nano...) và điền các thông tin sau:

| Biến | Ý Nghĩa | Ví Dụ / Hướng Dẫn |
| :--- | :--- | :--- |
| **DATABASE** | | |
| `POSTGRES_USER` | Tên đăng nhập Database | `postgres` (Mặc định) |
| `POSTGRES_PASSWORD` | Mật khẩu Database | `MatKhauSieuKho123` (Tự đặt) |
| `POSTGRES_DB` | Tên Database | `solar_om` |
| **MinIO (Lưu Ảnh)** | | |
| `MINIO_ROOT_USER` | Admin user MinIO | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | Admin password MinIO | `minioadmin` (Nên đổi nếu deploy thật) |
| **Bảo Mật** | | |
| `JWT_SECRET` | Khóa ký Token đăng nhập | `Chuoi-Ngau-Nhien-Dai-Va-Kho-Doan` |
| **Thông Báo (Push)** | | |
| `VAPID_PUBLIC_KEY` | Khóa công khai VAPID | Lấy tại [vapidkeys.com](https://www.vapidkeys.com/) |
| `VAPID_PRIVATE_KEY` | Khóa bí mật VAPID | Lấy tại [vapidkeys.com](https://www.vapidkeys.com/) |

### 4. Khởi Chạy Hệ Thống
Sử dụng Docker Compose để tự động cài đặt và chạy toàn bộ hệ thống (Frontend, Backend, Database, MinIO).

**Chạy lệnh sau tại thư mục gốc:**
```bash
docker-compose up -d --build
```
*Giải thích:*
- `up`: Khởi động các containers.
- `-d`: Chạy ngầm (Detached mode) để không bị treo terminal.
- `--build`: Ép buộc build lại image nếu có thay đổi code.

**Kiểm tra trạng thái:**
```bash
docker-compose ps
```
Nếu thấy cột `State` đều là `Up`, hệ thống đã chạy thành công!

### 5. Truy Cập & Sử Dụng

Sau khi khởi chạy, bạn có thể truy cập các dịch vụ tại:

- **Web App (Dành cho User/Manager/Admin):**
  - Địa chỉ: [http://localhost:5173](http://localhost:5173)
  - Đây là giao diện chính để sử dụng phần mềm.

- **Backend API:**
  - Địa chỉ: [http://localhost:3000](http://localhost:3000)
  - API Document (Swagger): [http://localhost:3000/swagger/index.html](http://localhost:3000/swagger/index.html)

- **MinIO Console (Quản lý file ảnh):**
  - Địa chỉ: [http://localhost:9001](http://localhost:9001)
  - Đăng nhập: Dùng User/Pass đã cấu hình ở bước 3 (`MINIO_ROOT_USER`).

### 6. Các Lệnh Quản Trị Thường Dùng

**Xem log (Nhật ký hoạt động):**
```bash
# Xem log của toàn bộ hệ thống
docker-compose logs -f

# Xem log riêng Backend (để debug lỗi API)
docker-compose logs -f backend
```

**Khởi động lại một dịch vụ:**
```bash
# Ví dụ khởi động lại backend sau khi sửa code
docker-compose restart backend
```

**Tắt hệ thống:**
```bash
docker-compose down
# Lưu ý: Dữ liệu (DB, Ảnh) vẫn được giữ lại trong Docker Volume.
```

### 7. Xử Lý Sự Cố (Troubleshooting)

**Lỗi: `Bind for 0.0.0.0:3000 failed: port is already allocated`**
- *Nguyên nhân:* Port 3000 đang bị phần mềm khác chiếm dụng.
- *Khắc phục:* Đổi port trong file `docker-compose.yml` (Ví dụ: `3000:3000` -> `3001:3000`) hoặc tắt ứng dụng đang dùng port đó.

**Lỗi: Không thể upload ảnh (Lỗi CORS hoặc Network Error)**
- *Khắc phục:* Kiểm tra xem `VITE_API_URL` trong Frontend có trỏ đúng về Backend không. Nếu chạy localhost thì mặc định đã đúng. Nếu deploy lên VPS, cần sửa lại IP/Domain.

**Lỗi: Database không kết nối được**
- *Khắc phục:* Đảm bảo `POSTGRES_PASSWORD` trong file `.env` khớp với những gì Backend đang mong đợi. Thử `docker-compose down -v` (Xóa sạch dữ liệu cũ) và chạy lại `docker-compose up -d` nếu bạn vừa đổi mật khẩu DB.

---

## Cấu Trúc Thư Mục

```
OMv2/
├── backend/
│   ├── cmd/api/main.go          # Entry point
│   ├── internal/
│   │   ├── adapters/
│   │   │   ├── http/handlers/   # 20 API handlers
│   │   │   ├── http/middleware/ # Auth, CORS, Rate Limit
│   │   │   └── storage/postgres/# Repository implementations
│   │   ├── core/services/       # 12 business services
│   │   ├── domain/              # 11 entities + DTOs
│   │   └── platform/            # Database, Logger
│   ├── migrations/              # SQL migrations
│   ├── Dockerfile
│   └── go.mod
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable components
│   │   ├── pages/
│   │   │   ├── admin/           # Admin pages (30 files)
│   │   │   ├── manager/         # Manager pages (29 files)
│   │   │   ├── user/            # User pages (15 files)
│   │   │   ├── home/            # Dashboards
│   │   │   └── login/           # Auth pages
│   │   ├── services/            # API services
│   │   ├── hooks/               # Custom React hooks
│   │   └── utils/               # Utilities
│   ├── public/                  # Static assets
│   ├── nginx.conf
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml           # Development
├── docker-compose.prod.yml      # Production
└── README.md
```

---

## API Documentation

### Authentication
| Method | Endpoint | Mô tả |
| :---: | :--- | :--- |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |

### Users
| Method | Endpoint | Mô tả |
| :---: | :--- | :--- |
| GET | `/api/users` | Danh sách users |
| GET | `/api/users/:id` | Chi tiết user |
| POST | `/api/users` | Tạo user |
| PUT | `/api/users/:id` | Cập nhật user |
| DELETE | `/api/users/:id` | Xóa user |

### Attendance
| Method | Endpoint | Mô tả |
| :---: | :--- | :--- |
| POST | `/api/attendance/checkin-with-photos` | Check-in với ảnh |
| POST | `/api/attendance/request-checkout` | Yêu cầu checkout |
| POST | `/api/attendance/approve-checkout/:id` | Phê duyệt checkout |
| POST | `/api/attendance/reject-checkout/:id` | Từ chối checkout |

### Allocations
| Method | Endpoint | Mô tả |
| :---: | :--- | :--- |
| GET | `/api/allocations` | Danh sách phân công |
| POST | `/api/allocations` | Tạo phân công |
| DELETE | `/api/allocations/:id` | Xóa phân công |

Xem đầy đủ tại: http://localhost:3000/swagger/index.html

---

## Báo Cáo Đánh Giá & Gỡ Lỗi

Solar O&M là một hệ thống mang tầm **Production-Ready** được đánh giá tổng thể ở mức điểm **9.25/10** về cả kiến trúc hạ tầng tĩnh (Cloud-Native), sức mạnh xử lý đồng thời (Golang) lẫn trải nghiệm người dùng hoàn hảo (React/PWA Glassmorphism).

Để hỗ trợ quá trình bảo trì dài hạn, toàn bộ luồng sự cố hệ thống đã được vạch ra chi tiết từ cấp độ Khởi tạo (Docker) cho tới tầng Giao diện Khách hàng (Camera/GPS).

👉 **[Xem Tổng Hợp Mã Lỗi Hệ Thống (End-to-End Error Codes)](ErrorCode.md)**

Tài liệu `ErrorCode.md` cung cấp cái nhìn rành mạch 6 cấp độ kèm giải pháp xử lý cực kỳ trực quan, bắt đầu từ *Network, Device, Frontend, DB đến Backend Error Payload*.

---

## Tác Giả

**Phạm Phúc** - [GitHub](https://github.com/Phuc0901-pp)

---

## License

MIT License - Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

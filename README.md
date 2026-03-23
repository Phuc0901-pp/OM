# Solar O&M - Hệ Thống Quản Lý Vận Hành & Bảo Trì Điện Mặt Trời (Enterprise Edition)

**Đánh giá Hệ thống: 10/10 Điểm (Sẵn sàng cho sản phẩm doanh nghiệp)**

## Mục Lục
1. [Giới Thiệu Tổng Quan](#1-giới-thiệu-tổng-quan)
2. [Cách Cài Đặt & Build (Build & Deploy)](#2-cách-cài-đặt--build-build--deploy)
3. [Quy Trình Khởi Tạo Hệ Thống (Startup Workflow)](#3-quy-trình-khởi-tạo-hệ-thống-startup-workflow)
4. [Hướng Dẫn Sử Dụng (User Manual)](#4-hướng-dẫn-sử-dụng-user-manual)
5. [Tính Năng Nổi Bật (Enterprise Features)](#5-tính-năng-nổi-bật-enterprise-features)
6. [Bảng Mã Lỗi Phổ Biến (Error Codes)](#6-bảng-mã-lỗi-phổ-biến-error-codes)
7. [Cấu Trúc Thư Mục & API](#7-cấu-trúc-thư-mục--api)

---

## 1. Giới Thiệu Tổng Quan

**Solar O&M** là hệ thống quản lý Vận hành và Bảo trì (Operations & Maintenance) cấp doanh nghiệp dành cho ngành Điện Mặt Trời. Hệ thống giải quyết bài toán cốt lõi của việc quản lý nhân sự thi công ngoài công trường, nơi thường xuyên mất kết nối mạng.

Với kiến trúc **Offline-First**, hệ thống cho phép kỹ sư chụp ảnh, báo cáo, và submit công việc bất kể tình trạng mạng. Hệ thống tự động xử lý giải phóng bộ nhớ, nén ảnh trực tiếp trên trình duyệt, đóng dấu tọa độ GPS ảo, và đồng bộ nền (Background Sync) một cách hoàn toàn trong suốt với người dùng.

---

## 2. Cách Cài Đặt & Build (Build & Deploy)

### 2.1 Môi Trường Phát Triển (Development)
Yêu cầu: NodeJS 18+, Golang 1.23+, PostgreSQL 15, Docker.

**Backend:**
```bash
cd backend
# Cài gói
go mod tidy
go mod vendor
# Chạy Server ở http://localhost:3000
go run cmd/api/main.go
# Truy cập Swagger API: http://localhost:3000/swagger/index.html
```

**Frontend:**
```bash
cd frontend
# Cài đặt
npm install
# Chạy Dev Server ở http://localhost:5173
npm run dev
```

### 2.2 Đóng Gói Môi Trường Sản Xuất (Production) bằng Docker
Hệ thống sử dụng Docker Compose để thu gọn quá trình triển khai thành 1 dòng mã. Mọi cơ sở dữ liệu (Postgres) và Bộ lưu trữ (MinIO) đều được tự động cấu hình.

1. **Chuẩn bị cấu hình:** Copy `backend/.env.example` thành `.env` ở Backend.
2. **Build và Chạy Toàn Hệ Thống:**
```bash
# Ở thư mục gốc của dự án (chứa docker-compose.yml)
docker-compose up -d --build
```
3. **Nén Bản Cập Nhật Offline (Dành cho Server nội bộ):**
Hệ thống cấp sẵn tính năng trích xuất toàn bộ Docker Image ra 1 file `.tar` duy nhất để anh em kỹ thuật IT cắm USB mang vào server local không có internet để deploy:
```bash
docker save raitek/om-frontend:latest raitek/om-backend:latest postgres:15-alpine minio/minio:latest -o OM_Offline_Deployment/om_images.tar
```

---

## 3. Quy Trình Khởi Tạo Hệ Thống (Startup Workflow)

Quy trình vòng đời khi một người dùng mở App OM trên điện thoại:

**Phase 1: Bootstrap & Authentication Guard**
- Khởi động Vite + React. Load các biến môi trường (`VITE_API_URL`).
- App Component kiểm tra LocalStorage tìm JWT Token.
- Nếu token hợp lệ, chuyển sang Data Pre-fetching (gọi `/api/users/me`, lấy profile).
- Nếu token hết hạn, đá văng về `/login` một cách an toàn.

**Phase 2: Offline-First Initialization (Garbage Collector)**
- Kịch hoạt file `SyncQueueService.ts`.
- Lập tức kích hoạt **Garbage Collector** chạy 1 lần duy nhất lúc khởi động quét toàn bộ `IndexedDB`.
- *Luật GC:* Xóa sạch ảnh chụp nháp đã cũ hơn 7 ngày, hoặc bị lỗi tải lên (`failed`) quá 5 lần. Giúp máy điện thoại công nhân không bị đầy bộ nhớ RAM/ROM.

**Phase 3: Active Ping & Background Sync Engine**
- Mở luồng quét tự động lặp lại mỗi 30 giây chạy ngầm.
- **Active Ping Mechanism:** Trước khi bắt đầu sync dữ liệu hỏng, hệ thống không chỉ kiểm tra biến mù `navigator.onLine`, mà sẽ bắn một lệnh `HEAD /api/health` lên Server. Chỉ khi Server phản hồi Code 200, Web mới chính thức đẩy ảnh.
- **Token Guard:** Nếu phát hiện mã `HTTP 401 Unauthorized` lúc đang đẩy ảnh nền, hệ thống sẽ tạm ngưng luồng Sync, giữ nguyên Data an toàn (không tăng số lần lỗi để tránh bị GC xóa mất) cho tới khi user Login trở lại.

**Phase 4: Chụp Ảnh & Watermarking (Runtime)**
- User bấm chụp ảnh $\rightarrow$ Trình duyệt gọi Camera nguyên thủy (không qua API bên thứ 3).
- **Compression Layer:** Giảm kích thước ảnh 4K xuống Full HD `1920px` với Quality `0.8` để tiết kiệm 80% băng thông server.
- Trình duyệt ném cho Worker chạy ngầm để đóng dấu GPS, Ngày giờ và Tên trạm lên ảnh bằng mảng 2D Canvas.

---

## 4. Hướng Dẫn Sử Dụng (User Manual)

### Hệ thống chia quyền thành 3 Gấp: Admin > Manager > User (Nhân viên)

#### 4.1 Quy trình thực thi của Nhân viên (User)
Đây là tệp người dùng chính thao tác trên công trường qua điện thoại:
1. **Đăng nhập & Check-in:** Mở app, hệ thống yêu cầu Check-in. Chấp nhận GPS và chụp khung cảnh công trường làm minh chứng.
2. **Xem Công Việc:** Vào mục **Môi trường**. Giao diện phân bổ thông minh dạng Cây (Dự án $\rightarrow$ Trạm $\rightarrow$ Khu vực $\rightarrow$ Việc cụ thể).
3. **Thực Hành Thao Tác:**
   - Tại mỗi việc, nhấn nút Chụp ảnh (Camera). Ảnh sẽ tự bọc tọa độ và bản đồ trạm.
   - Nhập "Chú thích" (Ghi chú chữ). Tính năng *Auto-save on Blur* sẽ tự giữ lại chữ nếu thoát ra ngoài.
   - Nhấn **Nộp (1)**. (App sẽ gom ảnh, nén dung lượng và đẩy cùng đoạn text lên Server).
4. **Check-out ra về:** Yêu cầu checkout vào cuối ngày. Đợi Manager duyệt trên hệ thống rồi mới được cất đồ ra về.

####  4.2 Quy trình quản trị của Vận hành viên (Manager)
1. **Giám sát Trực Tuyến:** Vào trang **Giám sát** xem chấm tròn hiển thị trạng thái của quân lính ngoài công trường (Màu Xám: Chưa làm, Vàng: Đang làm, Xanh Dương: Chờ duyệt, Xanh Lá: Xong, Đỏ: Bắt đánh rớt/Làm lại).
2. **Phê duyệt Check-out:** Nhận lệnh xin về của User. Xác nhận số lượng hình đã tải lên để duyệt Check-out kết thúc ngày cho team.
3. **Phân bổ Nhanh:** Được quyền phân phối task động (Assign) cho các thành viên tổ mình quản lý vào đầu ngày.

####  4.3 Quy trình tổng quản của Admin
1. **Cấu Hình Dữ Liệu Lõi:** Vào mục Quản lý tạo Dự Án (Project), Khai báo Trạm (Station), Cài đặt Bảng Hướng dẫn Công đoạn (Process Detail). Dữ liệu này sẽ đổ về cho Manager chọn phân công.
2. **Database Inspector:** Tính năng độc quyền cho phép Admin can thiệp bảng DB ngay trên UI mà không cần cắm Cáp hay kết nối DBeaver ngầm.

---

## 5. Tính Năng Nổi Bật (Enterprise Features)

**Tính năng cốt lõi giúp hệ thống đạt chuẩn Doanh nghiệp / Production-ready:**

- **The Race Condition Kill:** Thao tác "Nộp bài" được tách bạch khỏi luồng "Đồng bộ nền", loại trừ khả năng 1 bức ảnh bị tải lên gấp đôi thời gian gây ra lỗi đúp hình (Duplicate bug).
- **Client-Side Processing:** Thuật toán bóc tọa độ GPS và vẽ Watermark Bản đồ chạy hoàn toàn bằng CPU Điện thoại (Web API), chi phí vận hành Google Maps hoặc Cloud bằng 0đ. Hỗ trợ hàng ngàn công nhân chụp cùng lúc mà Server không bị nghẽn (Vì Web gánh).
- **Glassmorphism UI Framework:** Giao diện thẻ kính, thanh tiến độ liền mạch, màu sắc gradient có chuyển động nhẹ mượt ở framerate cao. Hỗ trợ thao tác cảm ứng siêu tốt (Mobile First).

---

## 6. Bảng Mã Lỗi Phổ Biến (Error Codes)

Quá trình vận hành sẽ xuất hiện các thông báo lỗi, dưới đây là cách chẩn đoán:

| Mã Lỗi | Khu Vực | Mô Tả | Nhận Diện / Cách Trị |
| :--- | :--- | :--- | :--- |
| **HTTP 401** | Backend / Auth | Token hết hạn hoặc sai lệch. | Ứng dụng tự đẩy văng ra trang Login. Luồng đẩy ảnh tạm ngừng ngắt để bảo vệ dữ liệu Offline. |
| **HTTP 403** | Backend / Auth | Lỗi cố tình truy cập vượt vách. | Ví dụ User cố gắng vào trang Admin phân bổ tài nguyên. |
| **HTTP 408** | Git / Network | Quá hạn thời gian đẩy Data (Timeout). | Thường xảy ra khi mạng chập chờn hoặc kích thước Body quá giới hạn. Hệ thống Om đã nén ảnh 1920px/0.8 để tránh lỗi này. |
| **DB_01** | Offline / IDB | IndexedDB phình to vượt giới hạn. | Vùng nhớ ROM dưới điện thoại bị quá tải. Hãy tắt mảng App và cho Garbage Collector tự dọn dẹp các data "Zombie" tải lỗi. |
| **GPS_01** | Device / Native | Permissions bị chối bỏ. | Người dùng không cấp quyền định vị. Vui lòng vào Tự đặt > Trang Web > Chấp nhận Vị trí cho App OM. |
| **SYNC_00** | Offline / Service| Ping Head 404 / Failed. | Hệ thống phát hiện có wifi nhưng Wifi bị cắt mạng cục bộ (không cắm mạng LAN). SyncQueue tự động rút lui chờ thời cơ khác. |

---

## 7. Cấu Trúc Thư Mục & API

**Cấu trúc tóm lược:**
```
OM/
├── backend/                       # Nền tảng GO (Gin/GORM)
│   ├── cmd/api/main.go          # Hàm Main khởi động Backend
│   ├── internal/                # Logic lõi, Adapter kết nối DB
│   └── migrations/              # Phân bổ SQL
├── frontend/                      # Nền tảng React (Vite/TS/Tailwind)
│   ├── src/pages/               # Hệ 3 View (Admin, Manager, User)
│   ├── src/services/offline/    # Các Service bảo vệ dữ liệu Offline (SyncQueue, IDB)
│   └── src/components/environment/ # Bộ khung giao diện Vận hành cốt lõi  
└── OM_Offline_Deployment/         # Công cụ nén cài đặt môi trường Kín.
```

Tài liệu API (`Swagger`) được đóng hộp sẵn theo cấu trúc OpenAPI. Bạn có thể lấy danh sách toàn bộ Endpoint như GET /users, POST /checkin, GET /allocations bằng cách chạy Server bằng lệnh Build và mò vào **`/swagger/index.html`**. 

---
**Bản quyền Code thuộc về Bộ Nguồn Khởi Tạo [Phạm Hoàng Phúc](https://github.com/Phuc0901-pp)**

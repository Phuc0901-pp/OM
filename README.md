# Raitek O&M - Hệ Thống Quản Lý Vận Hành & Bảo Trì Điện Mặt Trời

*(Phiên bản Enterprise V6.3.2 | Đánh giá Hệ thống: 10/10)*

**Tài liệu này là bản tổng hợp kỹ thuật và nghiệp vụ toàn diện nhất, thay thế cho toàn bộ các tài liệu phân mảnh trước đây.**

---

## Mục Lục
1. [Giới Thiệu Hệ Thống](#1-giới-thiệu-hệ-thống)
2. [Kiến Trúc & Công Nghệ Cốt Lõi (Tech Stack)](#2-kiến-trúc--công-nghệ-cốt-lõi-tech-stack)
3. [Luồng Vận Hành Nghiệp Vụ (Workflows)](#3-luồng-vận-hành-nghiệp-vụ-workflows)
4. [Các Tính Năng Công Nghệ Nổi Bật (Enterprise Features)](#4-các-tính-năng-công-nghệ-nổi-bật-enterprise-features)
5. [Hướng Dẫn Build & Triển Khai (Deployment Guide)](#5-hướng-dẫn-build--triển-khai-deployment-guide)
6. [Cấu Trúc Thư Mục & API](#6-cấu-trúc-thư-mục--api)
7. [Bảng Mã Lỗi & Xử Lý Sự Cố (Troubleshooting)](#7-bảng-mã-lỗi--xử-lý-sự-cố-troubleshooting)

---

## 1. Giới Thiệu Hệ Thống

**Raitek O&M (Operations & Maintenance)** là nền tảng quản lý chuyên biệt dành cho các nhà máy điện năng lượng mặt trời. 
Hệ thống giải quyết triệt để bài toán số hóa quy trình giao việc, thực thi ngoài hiện trường, báo cáo sự cố, và kiểm duyệt. Điểm mạnh nhất của hệ thống là khả năng vận hành trơn tru ở các vùng lõm sóng (Offline-Capable) và hệ thống phân cấp thiết bị đa tầng (Hierarchical Data Model).

Ứng dụng có thể chạy mượt mà trên Desktop (dành cho quản lý) và Mobile Web (PWA) để kỹ sư có thể mang ra công trường khảo sát.

---

## 2. Kiến Trúc & Công Nghệ Cốt Lõi (Tech Stack)

Hệ thống tuân thủ thiết kế **Clean Architecture**:

- **Frontend (Mobile-First SPA):**
  - ReactJS 18 (Vite, TypeScript), Tailwind CSS.
  - Quản lý trạng thái cục bộ với Zustand. Bắt sự kiện mạng qua Service Workers (PWA).
  - Tích hợp HTML5 Canvas & Geolocation Native API để xử lý ảnh trực tiếp tại trình duyệt.
- **Backend (High-Performance RESTful API):**
  - Golang (Gin Framework), tuân thủ Standard Go layout.
  - ORM: GORM kết nối PostgreSQL 15.
  - Authentication: JWT Token.
  - Background processes: Robfig Cron.
- **Lưu Trữ & Infra (Infrastructure):**
  - Database: PostgreSQL (Relational Data).
  - Object Storage: MinIO (tương thích AWS S3), chuyên lưu trữ hình ảnh check-in và file đính kèm tốc độ cao.
  - Reverse Proxy: Nginx.
  - Đóng gói: Hoàn toàn container hóa bằng Docker & Docker-Compose.

**Hierarchical Data Model (Cấu trúc dữ liệu):**
`Dự án (Project)` ➔ `Nhà máy (Plant)` ➔ `Biến tần (Inverter)` ➔ `Tấm pin/Tủ điện (Panel/String)`. Phân bổ công việc (Task) được gán vào 1 Node nhỏ nhất để dễ chẩn đoán và cô lập.

---

## 3. Luồng Vận Hành Nghiệp Vụ (Workflows)

Hệ thống được chia làm hai phân hệ quyền lớn: Cấp Quản lý (Trạm trưởng) và Kỹ sư hiện trường.

### 3.1 Cấp Quản Lý (Vận Hành & Điều Phối)
- **Tạo Cấu trúc & Biểu mẫu (Master Data):** Khởi tạo khung thiết bị của nhà máy và cấu hình Biểu mẫu (Checklist/Form) cho từng dạng bảo trì (vệ sinh, kiểm tra áp, v.v.).
- **Giao Việc (Allocation):** Chỉ định một Công việc + Biểu mẫu bảo trì + Kỹ sư, áp đặt Deadline lên 1 Thiết bị cụ thể.
- **Theo dõi Tiến độ (Operations Board):** Màn hình Data Grid lưới lớn giúp quản lý giám sát tiến độ của cả ngàn thiết bị trong vài giây dựa trên màu sắc Badge (Xanh=Xong, Vàng=Chờ duyệt, Đỏ=Trễ/Lỗi).
- **Phê duyệt (Approve/Reject):** Sau khi Kỹ sư nộp bài, Quản lý click vào bảng để chấm điểm, xem lại ảnh minh chứng và nhấn `Approve` hoặc `Reject` yêu cầu làm lại.

### 3.2 Kỹ Sư Hiện Trường (Thực Thi Offline)
- **Đăng nhập & Check-in:** Mở app trên điện thoại. Xem lịch làm việc ở mục **Môi Trường / Bảo Trì**. Bấm bắt đầu để chốt Timestamp chính xác.
- **Điền Biểu mẫu (Forms):** Nhập các thông số đo đạc điện áp, dòng điện thực tế. Tính năng *Auto-save on Blur* sẽ tự bảo vệ nội dung nháp đang viết lỡ mất mạng.
- **Chụp ảnh Minh chứng:** Sử dụng **Camera nội bộ WebRTC** của hệ thống (bị khóa upload file ngoài).
- **Nộp Báo cáo:** Kiểm tra và bấm Submit. Dữ liệu sẽ lập tức được đẩy về kho của Quản lý thông qua hệ thống Queue ngầm.

---

## 4. Các Tính Năng Công Nghệ Nổi Bật (Enterprise Features)

### 4.1. The Camera Anti-Fraud Engine (Hệ thống Camera Chống Gian Lận)
- **GPS Injection & Reverse Geocoding:** App gọi thẳng vệ tinh, giải mã tọa độ thành địa chỉ đường thực tế và chèn 1 bản đồ Minimap vào góc phải của tấm ảnh. Mọi bức hình đều chứng minh được kỹ sư thực sự đang đứng tại trạm.
- **Horizon Leveling (Thước thủy Vector):** Áp dụng toán học chiếu Vector Trọng Lực (Gravity Projection), khóa cứng ảnh ở cạnh đúng (0°, 90°, 180°, 270°) theo đường chân trời. Tấm ảnh đóng dấu luôn thẳng thớm dù kỹ sư thao tác úp/ngửa máy.
- **Canvas Compression (Nén nội suy Trình duyệt):** 1 bức ảnh 7MB từ Camera 4K được nén xuống FullHD (1920px) chất lượng 80% chỉ còn ~300KB trước khi gửi qua mạng 3G/4G, mà vẫn đủ sắc nét soi rõ đinh ốc.

### 4.2. Khả năng Offline-First Tuyệt Đối
- **SyncQueue & The Race Condition Kill:** Thao tác "Nộp bài" được tách độc lập với việc "Gửi file lên mạng". Nếu người dùng mất kết nối Internet, ảnh lưu trực tiếp bằng mảng nhị phân Blob vào `IndexedDB`.
- **Background Sync Machine:** Khi có lại mạng (`navigator.onLine` kết hợp cơ chế bắn Active Ping Server để né giả lập LAN), Web sẽ tự dùng một Background Service tuần tự đẩy các dòng ảnh nháp lên MinIO.
- **Garbage Collector (GC):** Bộ dọn dẹp bộ nhớ chạy mỗi lần mở app, tự động xóa các bức ảnh nháp quá 7 ngày lưu ở ROM Điện thoại hoặc các File tải lỗi quá 5 lần để tránh điện thoại bị đầy dung lượng.

---

## 5. Hướng Dẫn Build & Triển Khai (Deployment Guide)

### 5.1 Đóng gói cho Môi Trường Giao Dịch (Production)
Dự án được tối ưu để chỉ mất vài dòng lệnh tạo một "gói" (Tarball) mang vào những nhà máy điện khép kín không hề có Internet (Air-gapped enviroment).

*Bước 1: Build bộ Docker Images trên máy có mạng*
```powershell
docker build -t raitek/om-frontend:latest ./frontend
docker build -t raitek/om-backend:latest ./backend
# Export cả 4 hình khối (Web, API, MinIO, Postgres) ra 1 file ~250MB
docker save raitek/om-frontend:latest raitek/om-backend:latest postgres:15-alpine minio/minio:latest -o OM_Offline_Deployment/om_images.tar
# Xong, bạn có thể Zip thư mục OM_Offline_Deployment lại và Copy vào USB.
```

*Bước 2: Cài Đặt Tại Server Nhà Máy (Server Linux)*
```bash
# Sau khi mang file nén lên Server và giải nén
cd OM_Offline_Deployment
# 1. Đập hộp Docker Images từ USB
docker load -i om_images.tar
# 2. Sinh cấu hình
cp configs/.env.example configs/.env
# Thêm các biến: DB_PASSWORD, MINIO_SECRET_KEY, JWT_SECRET
# 3. Kích hoạt toàn bộ cụm
docker network create raitek_server || true
cd deployments
docker compose up -d
```

---

## 6. Cấu Trúc Thư Mục & API

**Sơ đồ Tóm Tắt:**
```text
OM/
├── backend/                       # Nền tảng GO RESTful API
│   ├── cmd/api/main.go          # Khởi động Service
│   ├── internal/                # Clean Architecture Logic (Domain, Services, Repository)
│   └── migrations/              # Script khởi tạo DB
├── frontend/                      # Nền tảng React TypeScript
│   ├── src/pages/               # Root Views (Manager, User, Auth)
│   ├── src/components/common/   # View Chia sẻ (Đặc biệt là CameraModal.tsx)
│   ├── src/services/offline/    # Tầng Database Trình duyệt (SyncQueue, IDBStore)
│   └── nginx.conf               # Luồng gác cổng Production (Reverse Proxy)
└── OM_Offline_Deployment/         # Folder cấu trúc ra Build
```

**Truy Cập API (Swagger):** 
Chạy Backend và truy cập: `http://localhost:4000/swagger/index.html` để lấy toàn bộ Specs tiêu chuẩn OpenAPI (GET, POST Checkin, Allocation...).

---

## 7. Bảng Mã Lỗi & Xử Lý Sự Cố (Troubleshooting)

Đây là tài liệu nằm lòng cho Kỹ sư và BP. Quản Trị Hệ Thống.

### 7.1 Mảng Frontend / Thiết Bị Đi Động
| Triệu Chứng / Lỗi | Xác Định Nguyên Nhân | Cách Xử Lý Triệt Để |
| :--- | :--- | :--- |
| **White Screen of Death** <br/>*(Trắng màn hình khi vào Web)* | Bộ đệm cache trình duyệt lưu bản file `index.html` cũ, trong khi phiên bản build js trên Nginx Server đã bị xóa/đúp đè. | **Xóa Cache Trình Duyệt:**<br/>- **iOS Safari:** Ở thanh địa chỉ tải, bấm "Aa", chọn "Tải lại bỏ chặn nội dung" / Xóa lịch sử.<br/>- **Android Chrome:** Xóa dữ liệu Browser cache "Từ trước đến nay". |
| **Camera Không Lên - Màn Hình Đen** | Do thiết bị không cấp quyền API nhạy cảm (`getUserMedia`) hoặc gọi bằng HTTP thường khóa bảo mật. | - Xác nhận kết nối HTTPS hoặc môi trường Localhost hợp lệ.<br/>- Bấm hình **Ổ Khóa** góc trái URL trình duyệt ➔ `Cài đặt trang web` (Site Settings) ➔ **Allow** Quyền `Máy ảnh` và `Vị trí`. F5 lại. |
| **Popup "Camera Off" Hiện Màu Đen Góc App** | Phần cứng hoặc Windows System cấm thiết bị thu hình từ gốc. | Đây là thông báo OSD (On-Screen Display) của OS, do người dùng lỡ ấn phím tắt `Fn + F8/Camera` hoặc gạt chốt cơ vật lý che camera trên Laptop (Asus/Lenovo). Mở lại chốt vật lý để dùng. |
| **Dấu Watermark mất Bản Đồ - `[---, ---]`** | Module Geocoding lấy kinh độ bị sai lệch do che chắn hoặc điện thoại giới hạn quyền độ phân giải cao. | 1. Điện thoại phải kích hoạt **Vị trí độ chính xác cao (Precise Location)** trong Settings gốc của App Trình Duyệt!<br/>2. Di chuyển khỏi không gian lồng Faraday (như gầm trạm biến thế sắt kính) khoảng 5 giây ra trời quang thiết bị mới bắt được vệ tinh. |

### 7.2 Mảng Backend / Kết Nối Mạng (Network & Storage)
| Mã Lỗi API | Diễn Giải Logic Lỗi | Chuẩn Đoán & Phương Pháp Sửa Chữa |
| :--- | :--- | :--- |
| **HTTP 401** | *Unauthorized (Sai JWT Token)* | Token JWT bị hết hạn. App sẽ tự đá ra khỏi trang (`MobileLogin`). Các thao tác nền như SyncQueue (Gửi ảnh ngầm) sẽ tự cúp luồng, ôm chặt data nháp không upload nữa và không đánh dấu Failed. Chỉ tiếp tục Sync khi User đăng nhập lại tài khoản hợp lệ. |
| **HTTP 403** | *Forbidden Access (Vượt Quyền)* | Tài khoản kỹ sư đang cố gắng call API Endpoint của Manager. |
| **HTTP 408** | *Timeout / Request Too Large* | Do Server xử lý đường truyền kém quá lâu nên tự hủy thao tác. Kiểm tra lại module Capture nén dung lượng, đảm bảo `quality` Canvas nằm ở mức `< 0.8` để Payload Body không lớn quá Nginx cho phép. |
| **SYNC_00** | *Fake Network Status* | Điện thoại bắt trúng 1 cục Wifi rỗng (không cắm dây Internet), `navigator.onLine` báo là có mạng nhưng Ping API `HEAD /api/health` trả HTTP lỗi chặn. ➔ Để yên hệ thống tự chạy ngầm chờ vòng Loop 30s tiếp theo rò mạng mới. |
| **DB_01** | *Full Quota IndexedDB* | Bộ lưu trữ App chạy bằng ROM điện thoại đã đầy. Khuyên dùng: Thoát đa nhiệm trình duyệt để *Garbage Collector* chạy lúc Web Loading dọn dẹp các ảnh đã gửi đi khỏi bộ nhớ đệm thiết bị. |

---
*Bản quyền kiến trúc và giải pháp công nghệ thuộc về **Phạm Hoàng Phúc**.*

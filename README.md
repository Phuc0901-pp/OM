# Solar O&M Management System (CMMS)

Hệ thống quản lý vận hành và bảo trì (O&M) cho các nhà máy điện năng lượng mặt trời. Dự án bao gồm Backend (Golang) và Frontend (React/Vite).

## 🚀 Trạng Thái Dự Án
- **Backend**: Đã cập nhật hỗ trợ Go 1.23+ và Docker hóa.
- **Frontend**: Chạy trên cổng 5173 để tránh xung đột.
- **Mobile App**: Đã cấu hình để chạy trên mạng LAN (IP: 192.168.31.160).
- **Android**: Đã sync code mới nhất, sẵn sàng build.

---

## 🛠️ Hướng Dẫn Chạy Bằng Docker (Khuyên Dùng)

Đây là cách nhanh nhất để khởi chạy toàn bộ hệ thống mà không cần cài đặt môi trường phức tạp.

### 1. Yêu cầu
- Đã cài đặt [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### 2. Khởi chạy
Mở Terminal (hoặc PowerShell) tại thư mục dự án và chạy:

```bash
docker-compose up -d --build
```
*(Lệnh này sẽ tự động tải Database, MinIO, build Backend và Frontend)*

### 3. Truy cập
Sau khi chạy xong, bạn có thể truy cập:

| Dịch Vụ | Đường Dẫn URL | Mô tả |
| :--- | :--- | :--- |
| **Giao diện Web** | [http://localhost:5173](http://localhost:5173) | Trang quản lý chính |
| **Backend API** | [http://localhost:3000](http://localhost:3000) | Server API |
| **API Docs** | [http://localhost:3000/api/swagger/index.html](http://localhost:3000/api/swagger/index.html) | Tài liệu lập trình |

> **Lưu ý**: Để tắt hệ thống, chạy lệnh `docker-compose down`.

---

## 📱 Hướng Dẫn App Mobile (Android)

### 1. Chạy nhanh (Qua trình duyệt điện thoại)
*   Đảm bảo điện thoại dùng chung Wi-Fi `192.168.31.160`.
*   Truy cập: `http://192.168.31.160:5173`.

### 2. Build file APK bằng Android Studio
Tôi đã chuẩn bị sẵn mã nguồn Android (đã sync IP mới nhất). Bạn làm theo các bước sau:

1.  Mở **Android Studio**.
2.  Chọn **Open** và tìm đến thư mục: `frontend/android`.
3.  Đợi Android Studio load xong dependencies (Gradle sync).
4.  Bấm nút **Run** (Play ▶️) để chạy trên máy ảo hoặc thiết bị thật.
5.  Hoặc vào menu **Build > Build Bundle(s) / APK(s) > Build APK(s)** để xuất file cài đặt.

> **Lưu ý**: Nếu bạn thay đổi code Frontend, hãy chạy lệnh sau trước khi build lại Android:
> ```bash
> cd frontend
> npm run build
> npx cap sync android
> ```

---

## 🌐 Public ra Internet (Cloudflare Tunnel)

Để truy cập từ xa (điện thoại, máy khác) mà không cần deploy lên server thật.

### Bước 1: Chạy hệ thống
Đảm bảo bạn đã chạy hệ thống (bằng Docker hoặc thủ công) và truy cập được ở **localhost**.

### Bước 2: Tạo Tunnel
Mở 2 cửa sổ Terminal (PowerShell) riêng biệt và chạy:

**1. Public Giao diện (Frontend)**
```powershell
cloudflared tunnel --url http://localhost:5173
```
*Copy đường dẫn `https://...trycloudflare.com` gửi cho người dùng.*

**2. Public API (Backend)**
```powershell
cloudflared tunnel --url http://localhost:3000
```
*Copy đường dẫn API này nếu cần cấu hình cho Mobile App hoặc bên thứ 3.*

---

## ⚙️ Cài Đặt & Chạy Thủ Công (Dành cho Dev)

Nếu bạn muốn chạy trực tiếp (không qua Docker) để sửa code.

### Yêu cầu
- **Go**: v1.23.0 trở lên.
- **Node.js**: v18 trở lên.
- **PostgreSQL & MinIO**: Phải đang chạy (hoặc dùng Docker chỉ chạy 2 service này).

### 1. Setup Backend
```bash
cd backend
# Đảm bảo file .env đã có (copy từ .env.example)
go mod download
go run cmd/api/main.go
```
*Backend chạy tại: `http://localhost:3000`*

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend chạy tại: `http://localhost:5173`*

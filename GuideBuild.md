# 🛠️ GuideBuild — Hướng dẫn Build & Đóng gói OM System

> **Cập nhật lần cuối:** 28/02/2026  
> **Phiên bản Docker:** 29.2.1  
> **Stack:** Go 1.24 · React (Vite) · PostgreSQL 15 · MinIO · Nginx

---

## 📋 Tổng quan

Hệ thống OM gồm 4 services chạy trên Docker:

| Service | Image | Port |
|---------|-------|------|
| Frontend (React + Nginx) | `raitek/om-frontend:latest` | `2506:80` |
| Backend (Go REST API) | `raitek/om-backend:latest` | `4000:4000` |
| Database (PostgreSQL) | `postgres:15-alpine` | `2602:2602` |
| Object Storage (MinIO) | `minio/minio:latest` | `2603, 2604` |

---

## 🔧 Yêu cầu môi trường

- **Docker Desktop** (Windows) / **Docker Engine** (Linux/Mac) — v24+
- **Git** để clone/pull code mới nhất
- **Kết nối internet** trong lần build đầu tiên (để pull base images)

---

## 🏗️ Quy trình Build đầy đủ

### Bước 1: Chuẩn bị & Kiểm tra Docker

```powershell
# Kiểm tra Docker đang chạy
docker version --format "{{.Server.Version}}"
# Kết quả mong đợi: 29.x.x (hoặc cao hơn)
```

---

### Bước 2: Build Frontend Image

```powershell
cd C:\...\OM\frontend
docker build -t raitek/om-frontend:latest .
```

**Quá trình:**
1. Install Node.js dependencies (`npm ci`)
2. Build React SPA (`npm run build` → `/dist`)
3. Copy output vào Nginx Alpine image
4. Set permissions cho Nginx

**Thời gian ước tính:** ~2–3 phút (có cache) / ~5–8 phút (lần đầu)

---

### Bước 3: Build Backend Image

```powershell
cd C:\...\OM\backend
docker build -t raitek/om-backend:latest .
```

**Quá trình:**
1. Download Go dependencies (`go mod download`)
2. Compile Go binary (`CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api`)
3. Copy binary + migrations vào Alpine image

**Thời gian ước tính:** ~2–3 phút (có cache) / ~5–10 phút (lần đầu)

---

### Bước 4: Export Docker Images ra file `.tar`

```powershell
cd C:\...\OM

docker save `
  raitek/om-frontend:latest `
  raitek/om-backend:latest `
  postgres:15-alpine `
  minio/minio:latest `
  -o OM_Offline_Deployment\om_images.tar
```

> ⚠️ **Lưu ý:** Bước này export cả 4 images vào 1 file tar duy nhất (~200–250 MB).  
> Thời gian: ~2–5 phút tuỳ tốc độ I/O ổ cứng.

---

### Bước 5: Đóng gói thành `OM_Offline_Package.tar.gz`

```powershell
cd C:\...\OM

tar -czf OM_Offline_Package.tar.gz OM_Offline_Deployment
```

**Nội dung package:**
```
OM_Offline_Deployment/
├── auto_start.sh                   # Script khởi động tự động (Linux)
├── om_images.tar                   # Docker images đã build (~220 MB)
├── configs/
│   └── .env.example                # Mẫu cấu hình môi trường
└── deployments/
    └── docker-compose.yml          # Docker Compose chính thức
```

**Kích thước output:** ~217 MB

---

## 🚀 Triển khai lên Server

### 1. Upload package lên server

```bash
# Dùng SCP
scp OM_Offline_Package.tar.gz user@<SERVER_IP>:/opt/

# Hoặc dùng SFTP, rsync, USB, v.v.
```

### 2. Giải nén trên server

```bash
cd /opt
tar -xzf OM_Offline_Package.tar.gz
cd OM_Offline_Deployment
```

### 3. Load Docker images

```bash
docker load -i om_images.tar
# Xác nhận:
docker images | grep raitek
```

### 4. Tạo file `.env`

```bash
cp configs/.env.example configs/.env
nano configs/.env   # Chỉnh sửa theo cấu hình server
```

**Các biến cần điền:**
```env
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=cmms_db
MINIO_ACCESS_KEY=your_minio_key
MINIO_SECRET_KEY=your_minio_secret
JWT_SECRET=your_jwt_secret
```

### 5. Tạo Docker network (nếu chưa có)

```bash
docker network create raitek_server
```

### 6. Khởi động toàn bộ hệ thống

```bash
cd deployments
docker compose up -d

# Kiểm tra trạng thái
docker compose ps
docker compose logs -f
```

### 7. Kiểm tra sau khi deploy

| Endpoint | URL |
|----------|-----|
| Frontend | `http://<SERVER_IP>:2506` |
| Backend API | `http://<SERVER_IP>:4000` |
| MinIO Console | `http://<SERVER_IP>:2604` |

---

## 🔄 Khi có code mới (Rebuild)

Nếu sửa code và cần deploy lại, **BẮT BUỘC** phải rebuild:

```powershell
# Lặp lại từ Bước 2 → Bước 5
docker build -t raitek/om-frontend:latest C:\...\OM\frontend
docker build -t raitek/om-backend:latest C:\...\OM\backend
docker save raitek/om-frontend:latest raitek/om-backend:latest postgres:15-alpine minio/minio:latest -o OM_Offline_Deployment\om_images.tar
# docker pull postgres:15-alpine; docker pull minio/minio:latest; docker build --no-cache -t raitek/om-backend:latest 
tar -czf OM_Offline_Package.tar.gz OM_Offline_Deployment
```

> 💡 **Gợi ý:** Chỉ cần rebuild image nào có code thay đổi để tiết kiệm thời gian.  
> Ví dụ: nếu chỉ sửa frontend, chỉ cần rebuild `raitek/om-frontend:latest`.

---

## 🛑 Dừng / Restart hệ thống trên Server

```bash
cd /opt/OM_Offline_Deployment/deployments

# Dừng tất cả
docker compose down

# Restart
docker compose restart

# Cập nhật image mới (sau khi load images mới)
docker compose up -d --force-recreate
```

---

## 📂 Cấu trúc thư mục dự án

```
OM/
├── backend/                    # Go REST API
│   ├── Dockerfile
│   ├── cmd/api/main.go
│   ├── internal/
│   └── migrations/
├── frontend/                   # React + Vite + Tailwind
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
├── deploy/                     # Dev/Prod compose files
│   ├── docker-compose.prod.yml
│   └── .env
├── OM_Offline_Deployment/      # Offline package source
│   ├── auto_start.sh
│   ├── om_images.tar           ← được tạo ở Bước 4
│   ├── configs/
│   └── deployments/
│       └── docker-compose.yml
└── OM_Offline_Package.tar.gz   ← file deploy cuối cùng
```

---

## ❗ Lưu ý quan trọng

| Vấn đề | Giải pháp |
|--------|-----------|
| `docker: command not found` | Cài Docker Desktop và đảm bảo đang chạy |
| Image cũ vẫn chạy sau deploy | Dùng `--force-recreate` khi compose up |
| Network `raitek_server` không tồn tại | Chạy `docker network create raitek_server` |
| MinIO bucket chưa có | Vào `http://server:2604` để tạo bucket `dev` |
| Backend không kết nối được DB | Kiểm tra biến `DB_*` trong `.env` |


| Tốt nhất là chơi như này: docker pull postgres:15-alpine; docker pull minio/minio:latest; docker build --no-cache -t raitek/om-frontend:latest C:\Pham_Phuc\UTE\YEAR4\HK2\Do_an_tot_nghiep_2425\Proj\Code\code\OM\frontend; docker build --no-cache -t raitek/om-backend:latest C:\Pham_Phuc\UTE\YEAR4\HK2\Do_an_tot_nghiep_2425\Proj\Code\code\OM\backend; docker save raitek/om-frontend:latest raitek/om-backend:latest postgres:15-alpine minio/minio:latest -o C:\Pham_Phuc\UTE\YEAR4\HK2\Do_an_tot_nghiep_2425\Proj\Code\code\OM\OM_Offline_Deployment\om_images.tar; tar -czf C:\Pham_Phuc\UTE\YEAR4\HK2\Do_an_tot_nghiep_2425\Proj\Code\code\OM\OM_Offline_Package.tar.gz -C C:\Pham_Phuc\UTE\YEAR4\HK2\Do_an_tot_nghiep_2425\Proj\Code\code\OM OM_Offline_Deployment; docker system prune -a -f|

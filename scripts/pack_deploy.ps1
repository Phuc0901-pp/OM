<#
.SYNOPSIS
Script đóng gói toàn bộ Docker Images của dự án Solar O&M phục vụ Deploy Offline (Tối ưu dung lượng, giảm tải Server).

.DESCRIPTION
Mô phỏng kiến trúc chuẩn:
- Build Images cục bộ trên Windows.
- Xuất file om_images.tar
- Tạo cấu trúc thư mục rõ ràng: deployments/, configs/
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition | Split-Path -Parent
$OutputDir = Join-Path $ProjectRoot "OM_Offline_Deployment"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " BẮT ĐẦU ĐÓNG GÓI OFFLINE DEPLOY SOLAR O&M" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Chuyển thư mục về gốc
Set-Location $ProjectRoot

# 2. Xóa và tạo thư mục xuất (với quy chuẩn cấu trúc rành mạch)
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }
New-Item -ItemType Directory -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputDir "deployments") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputDir "configs") | Out-Null

# 3. Build Backend & Frontend Images
Write-Host "`n[1/3] Đang Build Images (Golang & React)..." -ForegroundColor Yellow
docker build -t raitek/om-backend:latest -f backend/Dockerfile backend/
docker build -t raitek/om-frontend:latest -f frontend/Dockerfile frontend/

# 4. Lưu ra file .tar duy nhất
Write-Host "`n[2/3] Đang nộp thành file om_images.tar (quá trình này mất khoảng 1-2 phút)..." -ForegroundColor Yellow
$TarPath = Join-Path $OutputDir "om_images.tar"
docker save -o $TarPath raitek/om-backend:latest raitek/om-frontend:latest

# 5. Sắp xếp file cấu hình theo chuẩn
Write-Host "`n[3/3] Bố trí file Cấu hình & Docker Compose..." -ForegroundColor Yellow
# Lấy docker-compose.offline (đã rút gọn) đổi tên thành docker-compose.yml chuẩn
Copy-Item "deploy\docker-compose.offline.yml" -Destination (Join-Path $OutputDir "deployments\docker-compose.yml")
# Bỏ file env mẫu vào configs/ để dễ quản lý
Copy-Item "deploy\.env.example" -Destination (Join-Path $OutputDir "configs\.env.example")

Write-Host "`n=============================================" -ForegroundColor Green
Write-Host " HOÀN TẤT ĐÓNG GÓI! `n" -ForegroundColor Green
Write-Host "Thư mục xuất xưởng: $OutputDir" -ForegroundColor White
Write-Host "`n[HƯỚNG DẪN COPY LÊN SERVER LINUX]" -ForegroundColor Cyan
Write-Host "Anh chỉ cần copy 3 thành phần trong thư mục này thả lên Server:" -ForegroundColor White
Write-Host "  1. om_images.tar" -ForegroundColor White
Write-Host "  2. deployments/docker-compose.yml" -ForegroundColor White
Write-Host "  3. configs/.env.example" -ForegroundColor White
Write-Host "`n[TẠI SERVER LINUX]" -ForegroundColor Cyan
Write-Host "  docker load -i om_images.tar" -ForegroundColor White
Write-Host "  cp configs/.env.example .env" -ForegroundColor White
Write-Host "  docker-compose -f deployments/docker-compose.yml up -d" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green

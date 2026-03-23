<#
.SYNOPSIS
Script đóng gói toàn bộ Docker Images của dự án Solar O&M phục vụ Deploy Offline.

.DESCRIPTION
Quy trình chuẩn:
- Build Images backend + frontend cục bộ trên Windows.
- Xuất file om_images.tar (backend, frontend, postgres:15-alpine, minio/minio)
- Đóng gói toàn bộ OM_Offline_Deployment thành OM_Offline_Package.tar.gz
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition | Split-Path -Parent
$OutputDir = Join-Path $ProjectRoot "OM_Offline_Deployment"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " BAT DAU DONG GOI OFFLINE DEPLOY SOLAR O&M" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Chuyển thư mục về gốc
Set-Location $ProjectRoot

# 2. Xóa và tạo thư mục xuất
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }
New-Item -ItemType Directory -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputDir "deployments") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputDir "configs") | Out-Null

# 3. Build Backend & Frontend Images
Write-Host "`n[1/3] Dang Build Images (Golang & React)..." -ForegroundColor Yellow
docker build -t raitek/om-backend:latest -f backend/Dockerfile backend/
docker build -t raitek/om-frontend:latest -f frontend/Dockerfile frontend/

# 4. Save TẤT CẢ images vào 1 file .tar (backend, frontend, postgres, minio)
Write-Host "`n[2/3] Dang xuat file om_images.tar (backend + frontend + postgres + minio)..." -ForegroundColor Yellow
$TarPath = Join-Path $OutputDir "om_images.tar"
docker save raitek/om-backend:latest raitek/om-frontend:latest postgres:15-alpine minio/minio:latest -o $TarPath

# 5. Sắp xếp file cấu hình
Write-Host "`n[3/3] Bo tri file Cau hinh, Script & Docker Compose..." -ForegroundColor Yellow
Copy-Item "deploy\docker-compose.offline.yml" -Destination (Join-Path $OutputDir "deployments\docker-compose.yml")
Copy-Item "deploy\.env.example" -Destination (Join-Path $OutputDir "configs\.env.example")
Copy-Item "scripts\auto_start.sh" -Destination $OutputDir

# 6. Nén OM_Offline_Deployment thành OM_Offline_Package.tar.gz
Write-Host "`n[+] Dang nen thanh file OM_Offline_Package.tar.gz ..." -ForegroundColor Yellow
$TarGzPath = Join-Path $ProjectRoot "OM_Offline_Package.tar.gz"
if (Test-Path $TarGzPath) { Remove-Item -Force $TarGzPath }
tar.exe -czf $TarGzPath -C $ProjectRoot OM_Offline_Deployment

Write-Host "`n=============================================" -ForegroundColor Green
Write-Host " HOAN TAT DONG GOI!" -ForegroundColor Green
Write-Host "San pham dau ra: $TarGzPath" -ForegroundColor White
Write-Host "`n[HUONG DAN COPY LEN SERVER LINUX]" -ForegroundColor Cyan
Write-Host "1. Upload file OM_Offline_Package.tar.gz len Server Linux." -ForegroundColor White
Write-Host "2. Giai nen: tar -xzf OM_Offline_Package.tar.gz" -ForegroundColor White
Write-Host "3. Vao thu muc: cd OM_Offline_Deployment" -ForegroundColor White
Write-Host "4. Chay: bash auto_start.sh" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green

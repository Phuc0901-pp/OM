<#
.SYNOPSIS
Script đóng gói toàn bộ Docker Images của dự án Solar O&M phục vụ Deploy Offline (Tối ưu dung lượng, giảm tải Server).

.DESCRIPTION
Script này sẽ làm 3 việc:
1. Tự động Build trực tiếp các images của Frontend và Backend ngay trên máy tính cục bộ (Windows).
2. Nén 2 images này thành một file duy nhất: om_deploy_images.tar
3. Tạo ra thư mục "om_offline_package" chứa file .tar và file docker-compose để sẵn sàng kéo thả lên Server.
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition | Split-Path -Parent
$OutputDir = Join-Path $ProjectRoot "om_offline_package"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " BẮT ĐẦU ĐÓNG GÓI OFFLINE DEPLOY SOLAR O&M" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Chuyển thư mục về gốc
Set-Location $ProjectRoot

# 2. Xóa thư mục cũ nếu có
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

# 3. Build Backend Image
Write-Host "`n[1/3] Đang Build Backend Image (Golang)..." -ForegroundColor Yellow
docker build -t raitek/om-backend:latest -f backend/Dockerfile backend/

# 4. Build Frontend Image
Write-Host "`n[2/3] Đang Build Frontend Image (React/Nginx)..." -ForegroundColor Yellow
docker build -t raitek/om-frontend:latest -f frontend/Dockerfile frontend/

# 5. Lưu Images ra file .tar (Gộp cả 2 image vào chung 1 cục)
Write-Host "`n[3/3] Đang nộp 2 Images thành file om_deploy_images.tar (quá trình này mất khoảng 1-2 phút)..." -ForegroundColor Yellow
$TarPath = Join-Path $OutputDir "om_deploy_images.tar"
docker save -o $TarPath raitek/om-backend:latest raitek/om-frontend:latest

# 6. Copy các file cấu hình liên quan vào chung package
Write-Host "`n[+] Đang copy file docker-compose.prod.yml, docker-compose.offline.yml và .env.example ..." -ForegroundColor Yellow
Copy-Item "deploy\docker-compose.prod.yml" -Destination $OutputDir
Copy-Item "deploy\docker-compose.offline.yml" -Destination $OutputDir
Copy-Item "deploy\.env.example" -Destination $OutputDir

Write-Host "`n=============================================" -ForegroundColor Green
Write-Host " HOÀN TẤT ĐÓNG GÓI! `n" -ForegroundColor Green
Write-Host "Toàn bộ đồ nghề đã nằm sẵn trong thư mục: $OutputDir" -ForegroundColor White
Write-Host "1. Kéo thả nguyên thư mục này lên Server Linux." -ForegroundColor White
Write-Host "2. Trên Linux, gõ: docker load -i om_deploy_images.tar" -ForegroundColor White
Write-Host "3. Khởi chạy bằng lệnh: docker-compose -f docker-compose.offline.yml up -d" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green

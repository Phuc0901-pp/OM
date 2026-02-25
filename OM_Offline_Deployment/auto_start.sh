#!/bin/bash
# ==========================================
# AUTO START SCRIPT CHO SOLAR O&M (OFFLINE DEPLOY)
# Lệnh chạy: bash auto_start.sh
# ==========================================

echo -e "\033[1;36m=============================================\033[0m"
echo -e "\033[1;36m BẮT ĐẦU TRIỂN KHAI SOLAR O&M (OFFLINE MODE) \033[0m"
echo -e "\033[1;36m=============================================\033[0m"

# 1. Nạp Docker Images từ file tar
echo -e "\033[1;33m\n[1/3] Đang nạp Docker Images vào hệ thống...\033[0m"
if [ -f "om_images.tar" ]; then
    docker load -i om_images.tar
else
    echo -e "\033[1;31mLỖI: Không tìm thấy file om_images.tar. Vui lòng kiểm tra lại!\033[0m"
    exit 1
fi

# 2. Xử lý file môi trường .env
echo -e "\033[1;33m\n[2/3] Kiểm tra cấu hình môi trường...\033[0m"
if [ ! -f "configs/.env" ]; then
    echo "Tự động copy file .env.example sang .env..."
    cp configs/.env.example configs/.env
else
    echo "File configs/.env đã tồn tại, giữ nguyên cấu hình."
fi

# 3. Khởi chạy Docker Compose
echo -e "\033[1;33m\n[3/3] Đang khởi động toàn bộ hệ thống...\033[0m"
if [ -f "deployments/docker-compose.yml" ]; then
    # Để docker-compose nhận diện đúng file env trong thư mục configs
    docker compose -f deployments/docker-compose.yml --env-file configs/.env up -d
else
    echo -e "\033[1;31mLỖI: Không tìm thấy deployments/docker-compose.yml\033[0m"
    exit 1
fi

echo -e "\033[1;32m\n=============================================\033[0m"
echo -e "\033[1;32m HOÀN TẤT TRIỂN KHAI HỆ THỐNG! \033[0m"
echo -e "\033[1;32m=============================================\033[0m"
echo "Các container đang chạy ngầm. Gõ 'docker ps' để kiểm tra trạng thái."

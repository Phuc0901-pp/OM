#!/bin/sh
# =============================================================================
# Raitek O&M - MinIO to NAS Drive Sync Agent
# Chạy định kỳ: kéo file PDF mới từ MinIO về thư mục nas_drive (ổ Drive Công ty)
# 
# Cách hoạt động:
#   1. Cấu hình rclone kết nối vào MinIO (S3-compatible)
#   2. Lọc chỉ lấy file trong thư mục /Reports/ (bỏ qua ảnh thô của thợ)
#   3. Chạy rclone sync định kỳ (mặc định: 10 phút)
#   4. File mới/cập nhật sẽ được kéo về thư mục nas_drive được mount từ ổ NAS
# =============================================================================

set -e

MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:2603}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY}"
MINIO_BUCKET="${MINIO_BUCKET:-dev}"
NAS_DRIVE_PATH="${NAS_DRIVE_PATH:-/mnt/nas_drive}"
SYNC_INTERVAL="${SYNC_INTERVAL:-600}" # Mặc định 10 phút (600 giây)
# Chỉ đồng bộ các file trong thư mục "Reports" — không lấy ảnh thô
FILTER_PATTERN="${FILTER_PATTERN:-**/Reports/**}"

echo "======================================================"
echo " Raitek O&M - MinIO → NAS Drive Sync Agent"
echo "======================================================"
echo " MinIO:    http://${MINIO_ENDPOINT}/${MINIO_BUCKET}"
echo " NAS Path: ${NAS_DRIVE_PATH}"
echo " Lọc:     Chỉ thư mục /Reports/"
echo " Chu kỳ:  Mỗi ${SYNC_INTERVAL}s (~$(( SYNC_INTERVAL / 60 )) phút)"
echo "======================================================"

# Tạo thư mục đích nếu chưa có
mkdir -p "${NAS_DRIVE_PATH}"

# Cấu hình rclone kết nối vào MinIO
mkdir -p /root/.config/rclone
cat > /root/.config/rclone/rclone.conf << EOF
[minio]
type = s3
provider = Minio
access_key_id = ${MINIO_ACCESS_KEY}
secret_access_key = ${MINIO_SECRET_KEY}
endpoint = http://${MINIO_ENDPOINT}
path_style = true
EOF

echo "[SyncAgent] Cấu hình rclone đã sẵn sàng."
echo "[SyncAgent] Chờ MinIO khởi động..."

# Chờ MinIO sẵn sàng (retry tối đa 30 lần x 5s = 150s)
MAX_RETRIES=30
count=0
until rclone lsd minio:${MINIO_BUCKET} > /dev/null 2>&1; do
  count=$((count + 1))
  if [ $count -ge $MAX_RETRIES ]; then
    echo "[SyncAgent] LỖII: Không thể kết nối MinIO sau ${MAX_RETRIES} lần thử. Thoát."
    exit 1
  fi
  echo "[SyncAgent] MinIO chưa sẵn sàng, thử lại lần ${count}/${MAX_RETRIES}..."
  sleep 5
done

echo "[SyncAgent] Kết nối MinIO thành công!"

# ── Vòng lặp đồng bộ vô tận ──────────────────────────────────────────────────
while true; do
  echo ""
  echo "[SyncAgent] $(date '+%Y-%m-%d %H:%M:%S') - Bắt đầu đồng bộ..."

  # rclone copy: chỉ copy file MỚI hoặc CÓ THAY ĐỔI từ MinIO về NAS
  # --include "**/Reports/**" : Chỉ lấy file trong mọi thư mục Reports
  # --no-update-modtime        : Không cập nhật thời gian sửa đổi để tránh lặp vô hạn
  # --transfers 4              : 4 luồng tải song song
  # --low-level-retries 3      : Thử lại 3 lần nếu gặp lỗi mạng
  rclone copy \
    "minio:${MINIO_BUCKET}" \
    "${NAS_DRIVE_PATH}" \
    --include "**/Reports/**" \
    --include "**/reports/**" \
    --no-update-modtime \
    --transfers 4 \
    --low-level-retries 3 \
    --stats 0 \
    --log-level INFO \
    2>&1 | sed 's/^/[rclone] /'

  echo "[SyncAgent] $(date '+%Y-%m-%d %H:%M:%S') - Đồng bộ hoàn tất ✓"
  echo "[SyncAgent] Ngủ ${SYNC_INTERVAL}s trước lần tiếp theo..."
  sleep "${SYNC_INTERVAL}"
done

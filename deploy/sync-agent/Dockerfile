# =============================================================================
# Raitek O&M - Sync Agent Dockerfile
# Image gọn nhẹ (~60MB) dùng rclone để đồng bộ file từ MinIO về ổ NAS Drive
# =============================================================================
FROM rclone/rclone:latest

# Cài thêm công cụ cần thiết
RUN apk add --no-cache bash tzdata

# Múi giờ Việt Nam cho log đúng giờ
ENV TZ=Asia/Ho_Chi_Minh

# Copy script đồng bộ vào image
COPY sync.sh /sync.sh
RUN chmod +x /sync.sh

# Mặc định: đồng bộ mỗi 10 phút
ENV SYNC_INTERVAL=600

ENTRYPOINT ["/bin/sh", "/sync.sh"]

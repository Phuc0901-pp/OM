package messaging

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/minio/minio-go/v7"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
)

func TestFullDualWritePipeline(t *testing.T) {
	// 1. Dùng trực tiếp ổ Z:\07 Project Dept\09 Dev mà bạn đang có trên máy tính
	nasRoot := "Z:\\07 Project Dept\\09 Dev"
	testNasDir := filepath.Join(nasRoot, "Test_OM_DualWrite_FullPipeline")
	os.RemoveAll(testNasDir)
	os.MkdirAll(testNasDir, 0755)

	// Cài đặt đường dẫn NAS giả vào biến môi trường
	os.Setenv("NAS_STORAGE_DIR", testNasDir)
	t.Logf("[1] Đã bật biến NAS_STORAGE_DIR = %s", testNasDir)

	// Cấu hình kết nối MinIO bằng địa chỉ IP server thực tế ở cty (192.168.31.254)
	os.Setenv("MINIO_ENDPOINT", "192.168.31.254:2603")
	os.Setenv("MINIO_ACCESS_KEY", "phucraitek0539")
	os.Setenv("MINIO_SECRET_KEY", "090103Phuc")
	os.Setenv("MINIO_BUCKET", "dev")
	os.Setenv("MINIO_USE_SSL", "false")
	os.Setenv("RABBITMQ_URL", "amqp://test")
	t.Logf("[2] Đã cấu hình kết nối MinIO tới 192.168.31.254:2603")

	// 2. Tạo một file upload tạm trên máy tính
	tempUploadDir := filepath.Join(os.TempDir(), "OM_Uploads")
	os.MkdirAll(tempUploadDir, 0755)
	tempImageFile := filepath.Join(tempUploadDir, "fake_app_photo.jpg")
	os.WriteFile(tempImageFile, []byte("Test data: Bức ảnh này phải xuất hiện ở CẢ HAI NƠI (MinIO và NAS)"), 0644)
	t.Logf("[3] Tạo file ảnh tại thư mục nháp: %s", tempImageFile)

	// 3. Khởi tạo MinIO Client và giả lập Worker
	minioClient, err := storage.NewMinioClient()
	if err != nil {
		t.Fatalf("[ERROR] THẤT BẠI: Lỗi kết nối MinIO - %v", err)
	}

	worker := &MinioWorker{
		minioClient: minioClient,
	}

	objectPath := "Du-An-Pipeline/2026/04-2026/May-Bien-Ap/anh_chup_app.jpg"
	event := UploadRequestEvent{
		DetailAssignID: "test-id-1234",
		TempPath:       tempImageFile,
		ObjectPath:     objectPath,
		Filename:       "anh_chup_app.jpg",
		MimeType:       "image/jpeg",
	}

	t.Logf("[4] Kích hoạt hàm Worker.ProcessUpload() (Xử lý lưu đồng thời MinIO + NAS)...")
	err = worker.ProcessUpload(event)
	if err != nil {
		t.Fatalf("[ERROR] THẤT BẠI: Quá trình Upload bị lỗi - %v", err)
	}

	// 4. Kiểm tra xem file đã lọt vào NAS thật chưa
	expectedNasPath := filepath.Join(testNasDir, filepath.FromSlash(objectPath))

	if info, err := os.Stat(expectedNasPath); err == nil {
		t.Logf("[OK] THÀNH CÔNG! ẢNH ĐÃ ĐƯỢC CHUYỂN VÀO Ổ NAS (Z:)")
		t.Logf("[OK] Đường dẫn NAS: %s", expectedNasPath)
		t.Logf("[OK] Kích thước: %d bytes", info.Size())
	} else {
		t.Errorf("[ERROR] THẤT BẠI: File không tồn tại trên NAS: %v", err)
	}

	// 5. Kiểm tra file trên MinIO
	_, err = minioClient.Client.StatObject(context.Background(), "dev", objectPath, minio.StatObjectOptions{})
	if err == nil {
		t.Logf("[OK] THÀNH CÔNG! ẢNH ĐÃ NẰM TRÊN MINIO!")
		t.Logf("[OK] MinIO Object Path: %s", objectPath)
	} else {
		t.Errorf("[ERROR] THẤT BẠI KHI KIỂM TRA MINIO: %v", err)
	}
}

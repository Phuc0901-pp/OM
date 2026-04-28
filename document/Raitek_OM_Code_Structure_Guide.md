# Sơ Đồ Chuyên Sâu: Cây Thư Mục Toàn Cảnh (Directory Tree Analysis)
**Dự án:** Raitek O&M System (Operations & Maintenance)

Tài liệu này ánh xạ 1-1 với cấu trúc cây thư mục của Project. Chú thích được ghi thẳng hàng vào từng nhánh cây để bạn có thể nhìn bao quát từ trên xuống dưới mà không cần nhảy dòng phân tâm.

---

## 🌳 1. THƯ MỤC GỐC (ROOT)
```text
OM/
├── backend/                   👉 Toàn bộ mã nguồn máy chủ API (Golang).
├── frontend/                  👉 Toàn bộ mã nguồn giao diện khách (ReactJS).
├── deploy/                    👉 Cấu hình mạng lưới chạy Live (Môi trường chập mạng/Docker).
├── OM_Offline_Deployment/     👉 Bản cài đặt USB tự động cho khu vực trạm điện rớt mạng (Air-Gapped).
├── scripts/                   👉 (Tooling) Các mã lệnh dọn rác, restart, quản lý vòng lặp app.
├── vendor/                    👉 Bộ chứa code của thư viện ngoài tải sẵn về (Chống việc thư viện gốc bị xóa làm tịt web).
├── go.work                    👉 Khai báo đa thư mục cho Go (Go Workspace).
├── .env.example               👉 Cấu hình mẫu chìa khoá bảo mật.
└── Raitek_OM_*.md             👉 Tài liệu hướng dẫn thao tác cơ bản (Giống file bạn đang đọc).
```

---

## 🗄️ 2. PHÂN NHÁNH BACKEND (GOLANG CLEAN ARCHITECTURE)

![Backend Architecture Concept](file:///C:/Users/USER/.gemini/antigravity/brain/7a00e710-bed1-4b2f-9019-12e29f897f28/backend_folder_structure_1776838940080.png)

Hãy đi dọc theo vùng `internal/` – trái tim của hệ thống máy chủ, tuân thủ mô hình Củ Hành (Onion/Clean Architecture).

```text
backend/
├── cmd/api/                 
│   └── main.go                👉 START! Nơi bật chìa khóa nổ máy chủ, nạp file cấu hình và kéo các Router.
│
├── migrations/                👉 Chứa các file schema SQL. Trình kích hoạt dùng để tái lập lại Database trắng từ đầu.
│
└── internal/
    ├── domain/                👉 (TẦNG LÕI) CHỈ CHỨA CẤU TRÚC BẢNG. KHÔNG CHỨA LOGIC ĐẾM/TÍNH TOÁN.
    │   ├── allocation.go      👉 Bảng `Assign`, `DetailAssign` - Định nghĩa việc móc hình báo cáo vào công rảnh thời gian.
    │   ├── attendance.go      👉 Bảng `Attendance` - Quản lý checkin vị trí, thẻ định danh và giờ ra.
    │   ├── auth.go            👉 Bảng `User`, `Role`, `Team` - Thông tin phân quyền, ai làm sếp nhóm nào.
    │   ├── project.go         👉 Bảng `Project`, `Asset` - Tên nhà máy, trạm điện.
    │   ├── station.go         👉 Báo cáo hạ tầng trạm.
    │   └── stats.go           👉 Định nghĩa khung báo cáo Thống Kê (Dùng cho vẽ biểu đồ sếp).
    │
    ├── core/services/         👉 (TẦNG NÃO BỘ) NƠI GIẢI QUYẾT LUẬT LỆ (BUSINESS LOGIC)
    │   ├── allocation_workflow_service.go 👉 "Bộ Luật Lão làng": Quyết định duyệt/từ chối task, cập nhật JSONB. Móc nối ngầm qua `postApproveAsync` để báo với Lark.
    │   ├── allocation_media_service.go    👉 Quản lý việc ghi đường link hình ảnh chuẩn bị ném đi.
    │   ├── lark_service.go                👉 Móc nối API nội bộ qua server Lark. Xin token và tạo bản ghi Bitable.
    │   ├── attendance_service.go          👉 Tính toán giờ làm, cấp ảnh thẻ nhân sự lúc gác cổng.
    │   ├── user_service.go                👉 Hash mật khẩu, phong ấn/xóa tài khoản.
    │   └── reminder_service.go            👉 Thiết kế thông báo nhắc nhở đi làm / hoàn thành task.
    │
    ├── adapters/              👉 (TẦNG GIAO TIẾP I/O)
    │   ├── handlers/          👉 Router (API Cổng): Bắt lấy GET/POST/PUT từ Web đưa vào. VD: `allocation_handler.go`.
    │   ├── repositories/      👉 Kho hàng DB: Nơi chứa toàn bộ lệnh truy vấn GORM (SELECT, WHERE, JOIN...) đấm thẳng xuống PostgreSQL.
    │   └── middlewares/       👉 Người bóp cửa: Rà soát Token JWT, Kiểm duyệt phân quyền chặn truy cập lậu.
    │
    ├── infrastructure/        👉 (TẦNG HẠ TẦNG TRUNG GIAN)
    │   └── messaging/      
    │       ├── publisher.go   👉 Ném hình ảnh nặng vào đường bưu điện (RabbitMQ).
    │       ├── consumer.go    👉 "Thợ bốc vác": Rút dần yêu cầu để tải từ từ.
    │       └── minio_worker.go👉 "Thằng đẩy tạ": Kẻ bị bắt làm luồng đẩy file lên S3 / MinIO cục bộ mà không được than mệt đứng máy!
    │
    ├── platform/              👉 Các dịch vụ cắm ngoài
    │   ├── database/          👉 Logic đấu nối chuỗi connection string đến PostgreSQL/Redis.
    │   └── logger/            👉 Ghi lỗi Console dạng (Info, Debug, Error) nhanh siêu tốc bằng Zap.
    │
    └── utils/                 👉 Gọt tỉa dữ liệu (Chỉnh String, tạo UUID, Hash Base64 ...).
```

---

## 🎨 3. PHÂN NHÁNH FRONTEND (REACTJS / VITE / PWA)

![Frontend Architecture Concept](file:///C:/Users/USER/.gemini/antigravity/brain/7a00e710-bed1-4b2f-9019-12e29f897f28/frontend_folder_structure_1776838904190.png)

Máy chấm công bất bại, hoạt động như chiến thần kể cả khi máy bay qua vùng trắng phủ sóng mạng.

```text
frontend/
├── android/ & ios/            👉 Khung sườn code Native (Capacitor sinh ra) để biên dịch web này ra app đuôi .APK mượt mà trên điện thoại.
├── vite.config.ts             👉 Bộ máy xây thành: Cấu hình gộp code, làm mượt UI đóng gói theo chuẩn Offline, cắt mảnh nhỏ (Chunking) các thư viện.
├── tailwind.config.js         👉 Bản màu thiết kế. Định dạng bóng đổ thuỷ tinh (Aurora Glassmorphism), và gradient.
│
└── src/
    ├── services/              👉 TẦNG ĐIỆN TÍN KẾT NỐI
    │   ├── offline/           👉 🌟 TRÁI TIM CỦA ỨNG DỤNG (HỆ ĐIỀU HÀNH THU NHỎ).
    │   │   ├── OfflineStorageService.ts 👉 Chôn ảnh thẻ bằng chứng xuống con chip nhớ của điện thoại (IndexedDB).
    │   │   └── SyncQueueService.ts      👉 Máy trực ban mạng: Rớt mạng thì ngưng, có mạng thì gom từng 3 ảnh một luồng kéo cẩu lên Backend.
    │   ├── api/               👉 Dùng axios để call gọi sang Backend khi cần lấy danh sách làm việc. 
    │   └── websocketService.ts👉 Lắng nghe tiếng vọng của Hub Backend. Khi nghe "task_update" thì ra lệnh load lại hình ảnh để giao diện sếp nảy số (Real-time).
    │ 
    ├── stores/                👉 BỘ NHỚ NÃO NGẮN HẠN (ZUSTAND MUTATION)
    │   ├── authStore.ts       👉 Lưu phiên đăng nhập (Phiên hết hạn thì khoá cấm tải file lên mây).
    │   ├── uiStore.ts         👉 Nhớ trạng thái (Đang đóng cửa sổ bên hông hay mở).
    │
    ├── utils/                 👉 TOOL CHẾ TÁC BỀ MẶT HIỂN THỊ
    │   ├── watermarkUtils.ts  👉 Mã thuật ma thuật 1: Đi bêu Toạ Độ Vệ Tinh (GPS X&Y). Nén gập độ phân giải lại bằng thẻ Canvas. Dập thời gian vào pixel ảnh tuyệt đối không mờ. Dùng Blob ảo để chống lag cảm ứng màn hình mượt.
    │   └── imageUtils.ts      👉 Cắt gọt chuẩn khung hình Avatar 1:1.
    │
    ├── components/            👉 KHO VẬT LIỆU XÂY THÀNH
    │   ├── common/            👉 Cấu kiện lẻ tẻ: Cục Nút, Ô chữ màu mè, Nhãn dán.
    │   ├── Camera/            👉 Chứa hàm xỏ kim quyền vào thẳng cái Camera lõi điện thoại của người dùng (Native Bridge).
    │   └── Layout/            👉 Cái sườn ốp quanh màn hình (Sidebar bên rập khuôn).
    │
    ├── pages/                 👉 BỨC TRANH DO CÁC VẬT LIỆU (components) GÉP THÀNH.
    │   ├── Tasks/           
    │   │   └── Execution.tsx  👉 Trạm Nộp Số Dữ Liệu Thực Tế: Góc độ thợ bấm chụp hình hiện trường, gắn kết với lõi xử lí `OfflineStorageService`.
    │   ├── manager/           👉 Dữ liệu được trích xuất làm bảng theo dõi giám sát chỉ huy hiện trường.
    │   ├── user/              👉 Xem bảng theo dõi thời khóa của nhân viên trong ngày.
    │   └── login/             👉 Cánh cổng gác.
    │
    └── routes/                👉 (Router) Bản đồ chỉ đường. Nhập `domain.com/tasks` thì mở cái `pages/Tasks/` ra cho xem!
```

---

## 🛢️ 4. PHÂN NHÁNH KHỞI TẠO (DEPLOY) TRẠM BUNG 

![Deploy Architecture Concept](file:///C:/Users/USER/.gemini/antigravity/brain/7a00e710-bed1-4b2f-9019-12e29f897f28/deploy_folder_structure_1776839214350.png)

Tài liệu quý báu dành cho DevOps nếu muốn cắm trạm này xuống máy thật.

```text
OM/deploy/
├── docker-compose.prod.yml       👉 Bản Full Option dành cho chạy lên mạng diện rộng (Có Cụm Logstash/Elastic... để nghe ngóng Log lỗi ngầm).
├── docker-compose.offline.yml    👉 Bản Khắc Nghiệt (Air-Gapped): Loại bỏ chùm nhện công nghệ râu ria, chỉ dựng cái nào cứng nhất lên máy tính để bàn của trạm rớt mạng.
└── init_minio_quota.sh           👉 "Viên đạn bạc" giữ cân bằng ổ cứng: Chặn đứng ổ chứa hình MinIO khi ảnh quá 100GB. Tránh làm hỏng các dịch vụ thiết yếu của trạm như RDBMS.
```

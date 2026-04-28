# Định Hướng Kế Hoạch Phát Triển Hệ Thống Tương Lai (Future Development Evolution Roadmap)
**Dự án:** Hệ thống O&M Raitek (Operations & Maintenance)

Dựa trên nền tảng kỹ thuật hiện tại của Raitek O&M, tài liệu này phác thảo chiến lược mở rộng và nâng cấp hệ thống (System Scalability & Roadmap) trong giai đoạn tiếp theo. Kế hoạch này được cấu trúc hóa theo 4 phân hệ chính: Trải nghiệm Trạm cuối (Frontend/Client), Năng lực Máy chủ (Backend Core), Hạ tầng Cung ứng (Infrastructure/DevOps) và Ứng dụng Trí tuệ (AI/IoT). Tài liệu đóng vai trò như chương "Hướng Phát Triển Tiếp Theo" (Future Works) trong luận văn báo cáo Đồ án.

---

## 1. ỨNG DỤNG MÁY TRẠM & TRẢI NGHIỆM ĐẦU CUỐI (CLIENT-SIDE & FRONTEND EVOLUTION)

### 1.1 Khởi Tạo Mô Hình Mã Hóa Native Thực Tế (Native Framework Migration)
- **Thực trạng định vị:** Nền tảng hiện tại đang sử dụng PWA đóng gói vỏ Capacitor, tiềm ẩn giới hạn về băng thông xử lý đa tiến trình phần cứng.
- **Tiến trình tương lai:** Chuyển dịch phân hệ thiết bị di động sang nền tảng mã hóa gốc (Native Cross-platform) như **React Native** hoặc **Flutter**. Mục tiêu nhằm khai thác triệt để đa luồng CPU (Multi-threading) thiết bị di động, gia tăng giới hạn khung hình khung vẽ Canvas, qua đó tối ưu thuật toán chèn Watermark ma trận tọa độ vệ tinh một cách hoàn chỉnh.

### 1.2 Nhúng Thuật Toán Học Máy Trạm Biên (Edge Machine Learning / WebAssembly)
- **Thực trạng định vị:** Việc thu nhận hình ảnh hiện tại phụ thuộc hoàn toàn vào thao tác thủ công, chưa loại bỏ được những báo cáo sự cố (Faulty Reports) mang điểm mù chụp sai góc, rác ảnh hưởng băng thông MinIO S3.
- **Tiến trình tương lai:** Tích hợp mô hình Computer Vision hạng nhẹ (TensorFlow.js / WASM Edge ML) chạy ngay trên bộ nhớ trình duyệt Client. Thuật toán có khả năng đánh giá Sơ bộ (Pre-classification) bức ảnh, tự động phát hiện và cảnh báo tấm pin năng lượng mờ sương (Blur Detection) trước cả khi lưu và đẩy Queue.

---

## 2. NĂNG LỰC NHÂN MÁY CHỦ BẢN MẠCH (BACKEND CORE ARCHITECTURE)

### 2.1 Tiến Hóa Đường Truyền Khối Dữ Liệu Lớn bằng GraphQL (GraphQL Integration)
- **Thực trạng định vị:** Giao thức RESTful API hiện đang mang nhược điểm Dư thừa Thông tin (Over-fetching) đối với các lệnh truy xuất thông số Dashboard.
- **Tiến trình tương lai:** Tích hợp Giao thức truy vấn đồ thị (GraphQL Federation), cho phép hệ thống di động chỉ tải về chính xác cấu trúc dữ kiện cần thiết ở một thời điểm (Micro-payload). Giảm băng thông tiêu thụ dữ liệu 4G xuống 30% đối với các công nhân khai thác hoạt động trong khu vực sóng vô tuyến ngắt quãng.

### 2.2 Kiến Trúc Phân Rã Microservices Đại Quy Mô (Microservices & Domain Driven Design Expansion)
- **Thực trạng định vị:** Dù được viết theo Clean Architecture đảm bảo tính rời rạc, lõi ứng dụng vẫn đang chạy trong khuôn hình khối hợp nhất nguyên khối nhỏ (Modular Monolith).
- **Tiến trình tương lai:** Khi số lượng thiết bị trạm cuối vượt ngưỡng hàng nghìn concurrent (truy cập đồng thời), bắt buộc phải phân rã vùng Service Allocation (Giao việc) và Storage (Lưu trữ ảnh) thành các Container riêng biệt (Independent Scalable Microservices) trao đổi qua nội bộ mạng gRPC. Luận điểm này giúp hệ thống tự động bành trướng năng lực vi xử lý tương ứng dựa trên biểu đồ chịu tải theo thời gian thực (Auto-scaling).

---

## 3. HẠ TẦNG CUNG ỨNG VÀ KẾT NỐI (INFRASTRUCTURE & DEVOPS)

### 3.1 Dây Chuyền Chuyển Giao Tự Động (CI/CD Pipeline Automation)
- **Thực trạng định vị:** Quy trình đóng gói và thiết lập Docker (`.tar`) đang phụ thuộc thủ công thông qua tệp mã lệnh vật lý (Bash script).
- **Tiến trình tương lai:** Xây dựng mạng lưới CI/CD (Sử dụng GitHub Actions hoặc GitLab CI). Quá trình rà soát quy chuẩn mã nguồn (Linting), Kiểm định Đơn vị (Unit Testing - Mocking Gorm Database) sẽ được số hóa và ngăn chặn rủi ro tự động hoàn toàn trước khi Compile và đúc thành tệp Artifact đưa ra nhà máy độc lập.

### 3.2 Cao Độ Sẵn Sàng và Cụm Phân Tán (High Availability & Clustering)
- **Thực trạng định vị:** Các khâu RabbitMQ, Postgres và MinIO hiện được giới hạn là 1 điểm nút màng lưới độc lập (Single Node).
- **Tiến trình tương lai:** Thiết lập các chùm tính toán đa cực (Kubernetes Cluster). Kiến trúc Data Database sẽ được nâng cấp thành mô hình Master-Slave Replica, và MinIO sẽ chuyển hóa mảng phân mảnh tệp (Erasure Coding) trải dải 4 máy chủ vật lý, cam kết tính vẹn toàn tệp không bị tổn hại ngay cả trong thảm họa sập điện nguyên ổ cứng ở hai máy nhánh.

---

## 4. ỨNG DỤNG NGHIỆP VỤ CAO CẤP (ADVANCED BUSINESS & IOT)

### 4.1 Tích Hợp Hệ Số SCADA và Mạng Lưới Điểm Nút Vạn Vật (SCADA & IoT Telemetry)
- **Thực trạng định vị:** Nút hệ thống hiện tại định lượng tác vụ theo dạng nhập liệu khảo sát thực chứng từ con người (Manual Reporting Input workflows).
- **Tiến trình tương lai:** Mở Cổng Dị Dịch (Protocol Translators) như Modbus TCP hoặc MQTT để hệ máy chủ Backend trực tiếp đọc các chỉ báo sóng siêu âm/nhiệt kế hiện trường được kết nối trên các mảng Inverter quang năng điện. Biến đổi Raitek O&M thành một hệ thống cảnh báo Tiên lượng dự báo (Predictive Maintenance System).

### 4.2 Thiết Kế Chuỗi Kiểm Chứng Bất Biến (Blockchain / Immutable Audit Logging)
- **Tiến trình tương lai:** Tăng cường cường độ minh bạch của hệ sinh thái giao nhận bằng cách Hash lại (Mã hóa phân vùng) Log phê duyệt. Việc này chặn đứng toàn bộ khả năng sửa đổi thao tác lịch sử sau cùng (Non-repudiation) của Trưởng bộ phận hay Lập trình viên trong cơ sở dữ liệu đối với những chu trình công việc mang tính pháp lý hoặc kinh tế lớn.

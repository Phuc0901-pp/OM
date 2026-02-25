# TỔNG HỢP MÃ LỖI HỆ THỐNG TOÀN DIỆN (SYSTEM ERROR CODES)
*Tài liệu đặc tả sự cố End-to-End từ cấu hình Hạ tầng (Infrastructure) đến Thiết bị đầu cuối (Client Device)*

Tài liệu này tổng hợp nguyên nhân và giải pháp khắc phục cho toàn bộ sự cố có thể xảy ra trong vòng đời vận hành của hệ thống Raitek Solar O&M. Bộ mã lỗi phân rạch ròi thành 6 cấp độ (Layers) từ dưới lên trên.

---

## 1. MỨC 1: HẠ TẦNG & KHỞI TẠO (INFRASTRUCTURE & BOOTSTRAP)
Xử lý các lỗi gián đoạn do môi trường (Environment) trong quá trình máy chủ Server khởi động hoặc Container bị stop.

| Mã Lỗi (Error Code) | Phân Hệ | Căn nguyên cốt lõi | Biện pháp giải quyết |
|:--------------------|:--------|:-------------------|:---------------------|
| `ERR_ENV_MISSING`   | Environment | Thiếu file `.env` hoặc thiếu tham số cấu hình tĩnh bắt buộc như PORT, DB_DSN, REDIS_URL. | Tạo lại file `.env` tại thư mục gốc backend dựa trên template `.env.example`. |
| `ERR_DB_TCP_CONN`   | PostgreSQL | Port 5432 của cơ sở dữ liệu đóng, ứng dụng không thể Bind TCP. | Xem log service PostgreSQL/Docker để khởi động lại dịch vụ DB. |
| `ERR_REDIS_REFUSED` | Redis Pub/Sub | Mất kết nối tới máy chủ Redis (Port 6379), hệ thống Message Message Queue bị từ chối tín hiệu. | Reboot Redis-server. Đảm bảo cấu hình auth password trong .env khớp. |
| `ERR_MINIO_DIAL`    | MinIO Storage | Core lưu trữ không truy xuất được DNS hoặc IP đích của server MinIO (Timeout). | Kiểm tra mạng WAN server. Xác nhận lại Access Key và Secret Key. |
| `ERR_ADDR_IN_USE`   | Web Server (Gin) | Port 4000 mà API Golang sử dụng đã bị một ứng dụng khác chiếm vĩnh viễn. | Chạy lệnh `netstat -ano \| findstr :4000` và kill tiến trình thừa. |

---

## 2. MỨC 2: CƠ SỞ DỮ LIỆU & ORM (DATABASE LEVEL)
Xử lý các xung đột trong quá trình GORM đọc, ghi và bảo toàn tính toàn vẹn thông tin (ACID) vào ổ đĩa.

| Mã Lỗi (Error Code) / Ngoại Lệ | Phân Hệ | Căn nguyên cốt lõi | Biện pháp giải quyết |
|:-------------------------------|:--------|:-------------------|:---------------------|
| `gorm.ErrRecordNotFound`       | Cấu trúc GORM | Truy vấn dữ liệu cho một UUID hoàn toàn không khớp hoặc đã bị xóa vĩnh viễn. | Bắt exception tại Repository, ném HTTP 404 cho API chứ không throw Panic. |
| `pq: duplicate key value`      | Ràng buộc RDBMS| Khởi tạo 1 thẻ Entity trùng Unique Constraint với dữ liệu có sẵn (Email, ID Kỹ sư...). | Cảnh báo Data Trùng Lặp ở tầng UI và ngắt cờ loading. |
| `pq: foreign key constraint`   | Ràng buộc RDBMS| Xóa cứng (Hard delete) một Dữ liệu Gốc đang làm mỏ neo tham chiếu cho hàng trăm Dữ liệu Nhánh. | Giấu nút xóa cứng trên Client, thiết kế Soft-Delete (Update cờ `deleted_at`). |
| `gorm.ErrInvalidDB`            | GORM Session | Con trỏ kết nối Database trả về NULL do fail ở mức Hạ tầng (Mức 1). | Terminate toàn bộ App ngay lập tức trên CMD để né thảm họa corrupt data. |
| `migration failed`             | golang-migrate | Schema Table (Bảng) giữa file Code và thực tế chênh lệch Version. | Dùng tool `migrate` down 1 bậc và up lại, hoặc clear bảng `schema_migrations`. |

---

## 3. MỨC 3: API BACKEND & LOGIC (APPLICATION ERRORS)
Phần lõi nghiệp vụ. Các mã lỗi này được trả dưới chuẩn RESTful HTTP Response từ Server ra Client.

| Mã HTTP | Loại Lỗi (Error Type) | Căn nguyên cốt lõi trong nghiệp vụ O&M | Biện pháp giải quyết |
|:-------:|:----------------------|:---------------------------------------|:---------------------|
| `400`| Bad Request | Body request thiếu Schema, hoặc tham số param truyền URL không phải là format chuỗi UUID chuẩn. | Thiết kế hàm Validate ở Frontend thật chặt trước khi fire API Fetch. |
| `401`| Unauthorized | Call API bảo mật nhưng Request Header không kẹp chuỗi Token `Authorization: Bearer <JWT>`. | Frontend sẽ tự động xóa LocalStorage và chuyển điều hướng về trang Login. |
| `403`| Forbidden | Một tài khoản Role bình thường cố trỏ vào API cấm (Admin Route hoặc luồng duyệt báo cáo cho Manager). | Báo cảnh báo "Tài khoản thiếu quyền hạn" trên giao diện trung tâm. |
| `404`| Not Found | Định danh truy tìm Thiết bị / Check-in / Trạm bị gãy (không tìm thấy trên CSDL do đã xóa). | Ẩn chi tiết trang / Hiện thị nội dung Placeholder Fallback. |
| `409`| Conflict Status | Xung đột nghiệp vụ: Kỹ sư nộp Báo cáo (Click Submit) nhưng lúc đó Manager vừa click nút Approved/Rejected trên bảng điều khiển cùng lúc. | Frontend thiết kế auto F5 socket state thay vì cho phép đè kết quả. |
| `413`| Payload Too Large | Ảnh Upload dạng Payload Multipart tràn vượt giới hạn Byte cấu hình cố định trong Gin. | Component tải ảnh của Client cần Scale & Nén ảnh trước đi bắn POST. |
| `500`| Internal Server | Hàm Golang bắt Panic Runtime (vd: Index Out of bound), truy xuất ổ cứng văng lỗi. | Rà file `error.log` cục bộ hàng ngày. Không lộ Stacktrace lỗi về Frontend. |

---

## 4. MỨC 4: GIAO DIỆN CLIENT (FRONTEND PWA ERRORS)
Xử lý lỗi ném ra nội bộ trên tiến trình JavaScript của Trình duyệt Web / SmartPhone và ứng dụng React.

| Exception Ném Ra | Phân Hệ | Căn nguyên cốt lõi | Biện pháp giải quyết |
|:-----------------|:--------|:-------------------|:---------------------|
| `Axios Network Error` | Giao tiếp Fetch | Rớt cáp quang 3G/Wifi từ điện thoại, hoặc tiến trình `.exe` Backend Server bị ngắt. | Cung cấp UI Modal "Kiểm tra kết nối Wifi/3G của bạn". |
| `TypeError: Cannot read properties` | Họa hình React | Biến truyền JSON về bị khuyết trường giá trị (Field) dẫn đến thẻ Component đâm vào biến Null. | Code React buộc phải quấn Optional Chaining `(?:)` ở 100% data Fetch. |
| `Yup/Zod Validation Error`| Form Input | Validation Schema trên Form cắm cờ đỏ khi người dùng gõ sai chuỗi chuẩn (SDT, Email, Number). | Bôi viền TextBox màu Đỏ, chặn khóa nút Submit bằng thuộc tính disabled. |
| `DOMException: QuotaExceeded`| JS Storage | Mức rác LocalStorage / File blob nén trên Browser PWA sinh ra quá lớn, nuốt trọn bộ nhớ điện thoại cấp. | Xây dựng thuật toán Clear IndexedDB khi số lượng bản Draft vượt 50 lượt. |
| `WebSocket Connection Closed` | Real-time WS | Kết nối ngầm giữa React và Socket Backend giật lag và tự ngắt do quá Timeout ping/pong. | Code cơ chế Exponential Backoff (Tự đứt tự nối lại sau mỗi 2s, 4s, 8s...). |

---

## 5. MỨC 5: PHẦN CỨNG NGOẠI VI (DEVICE HARDWARE ERRORS)
Xử lý sự cố cấp độ truy xuất phần cứng khi Kỹ sư vận hành thao tác vật lý trên Mobile/Tablet ngoài hiện trường.

| Exception Ném Ra | Phân Hệ Ngữ Cảnh| Căn nguyên cốt lõi | Biện pháp giải quyết |
|:-----------------|:----------------|:-------------------|:---------------------|
| `GeolocationError: 1` | Module GPS | (PERMISSION_DENIED): Nhân viên thủ công bấm nút từ chối dứt điểm quyền truy vết Vị trí trên Box Chrome / Safari. | Hướng dẫn thủ công vào Setting > Site > Allow Location cho tên miền Dự án. |
| `GeolocationError: 2` | Module GPS | (POSITION_UNAVAILABLE): Điện thoại hỏng bộ định tuyến, hoặc đứng sâu dưới hầm thiếu trạm phát sóng định vị. | Khuyên kỹ sư đổi thiết bị, di chuyển lên bề mặt thoáng để quét tọa độ. |
| `GeolocationError: 3` | Module GPS | (TIMEOUT): Module định vị của Android/iOS load mảng vị trí lâu hơn cấu hình timeout ứng dụng giới hạn. | Tăng TimeLimit lên tối đa, Code hàm thử bắt sóng (Retry capture) 3 lần. |
| `NotAllowedError` | Module Camera | Browser tự động chặn yêu cầu bật cổng Camera. | Bắt buộc bật Media Permission thủ công trong màn cấu hình Web. Chặn luồng Check-in. |
| `NotFoundError`| Module Camera | Phần cứng hoàn toàn không kết nối (hoặc không tồn tại củ Camera máy ảo/PC bàn). | Kỹ sư buộc đăng nhập sang thiết bị điện thoại / iPad đúng chuẩn O&M. |

---

## 6. MỨC 6: XUYÊN MẠNG CỬA NGÕ (PROXY & NETWORK ERRORS)
Bao gồm các trục trặc về Proxy Nginx, Cầu nối DNS, và tải lưu lượng ở chốt chặn tiền đồn.

| Mã Lỗi (Code) | Phân Hệ Ngữ Cảnh| Căn nguyên cốt lõi | Biện pháp giải quyết |
|:--------------|:----------------|:-------------------|:---------------------|
| `502 Bad Gateway`| Nginx Reverse Proxy | Nginx tiếp nhận yêu cầu 100% sống khỏe nhưng khi Dispatch qua Port 4000 của Backend thì không phản hồi (Dead). | Kiểm tra lại tiến trình Terminal của Go Backend còn chạy hay không. |
| `504 Gateway Timeout` | Nginx Reverse Proxy | Nginx gửi yêu cầu sang Backend nhưng tiến trình Xử lý (như Chẻ API List Lịch sử 100 trang) mất tận 2 phút. Nginx nhả cờ vớt. | Tăng param `proxy_read_timeout` trên config của Nginx hoặc tách API Heavy sang Background Job. |
| `CORS Origin Error` | Preflight HTTP | Backend cấm API gọi bởi tên miền không nằm trong danh sách trắng (Whitelist) cấu hình bảo mật. | Báo Admin setup Middleware CORS bên Gin mở tên miền Frontend cụ thể. |
| `MinIO Proxy 404` | Cầu nối Media | Đường dẫn Fetch ảnh bị chứa khoảng trắng bẩn, encoding sai `%20` hoặc Array String làm Image Proxy vỡ cấu trúc Key gốc. | Chạy thuật toán dọn dẹp biến String URl hoặc parse Array JSON ở UI. |

# Tài Liệu Phân Tích Kiến Trúc Triển Khai Docker Môi Trường Ngoại Tuyến (Offline Docker Deployment Architecture Analysis)
**Dự án:** Hệ thống O&M Raitek (Operations & Maintenance)

Tài liệu này cung cấp các phân tích nền tảng chuyên sâu (Enterprise-level Architecture) cho chiến lược tái cấu trúc và đưa toàn bộ ứng dụng phần mềm Raitek lên môi trường Docker (Containerization) theo khuôn mẫu hoàn toàn ngoại tuyến không lệ thuộc Internet (Air-gapped Deployment). Cấu trúc tài liệu bám sát ngôn ngữ kỹ thuật học thuật, phục vụ quá trình bàn giao phương luận đồ án và kiểm định lý thuyết.

---

## 🌳 MÔ HÌNH TOÁN ĐỒ KIẾN TRÚC MẠNG VI DỊCH VỤ (MICROSERVICES NETWORK TOPOLOGY)

*(Ghi chú: Lớp kiến trúc mô phỏng theo phương thức mạng nội bộ của Hệ điều phối Docker Compose)*

```mermaid
graph TD
    classDef proxy fill:#ffcc80,stroke:#e65100,stroke-width:2px,color:#000
    classDef client fill:#b3e5fc,stroke:#0277bd,stroke-width:2px,color:#000
    classDef backend fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef data fill:#e1bee7,stroke:#6a1b9a,stroke-width:2px,color:#000
    classDef host fill:#eceff1,stroke:#455a64,stroke-width:2px,color:#000

    Host[Máy Trạm Vật Lý Nền Tảng (Windows / Linux Host)]:::host
    
    subgraph Mạng Docker Kín (Isolated Bridge Network: om-network)
        Nginx[Nginx Reverse Proxy \\n Điểm Mút Trung Chuyển Lõi]:::proxy
        FE[Khối Giao Diện Frontend \\n Nginx Static Server]:::client
        BE[Máy Chủ Xử Lý Golang \\n Raitek Core Backend]:::backend
        DB[(PostgreSQL \\n RDBMS Data Layer)]:::data
        Rabbit[RabbitMQ \\n Advanced Message Broker]:::data
        MinIO[(MinIO S3 \\n File Object Storage)]:::data
        
        Nginx -->|Định tuyến /| FE
        Nginx -->|Định tuyến /api| BE
        Nginx -->|Tải trọng tĩnh/minio| MinIO
        
        BE -->|Phân phối Luồng| Rabbit
        BE <-->|Phiên Giao Dịch Truy Cập| DB
        BE -->|Thao tác Luồng Tin Mạng| MinIO
    end
    
    Host -->|Ánh Xạ IPv4 - Port Cổng 80/443| Nginx
```

---

## 🌳 THIẾT KẾ PHÂN TẦNG VẬT LÝ VÙNG DEPLOY (DEPLOYMENT DIRECTORY STRUCTURE)

Hệ thống được đóng gói với độ phân rã chức năng nhằm đơn giản hóa nghiệp vụ cho các cấp khai thác (SysAdmin).

```text
OM_Offline_Deployment/
├── auto_start.sh              👉 [Bootstrapping] Kịch bản Bash Shell cấp tốc triển khai mọi quy trình. Nạp và khởi động hệ thống tệp `.tar`.
├── om_images.tar              👉 Tệp vật lý cấp nguyên thủy cấu trúc (Docker Image Archive).
│
├── configs/                   🌟 (MODULE CẤU HÌNH THAM SỐ TOÀN CỤC)
│   ├── .env                   👉 Chứa tập hợp tham số bảo mật mật khẩu, chứng chỉ (Môi trường thực tiễn).
│   └── .env.example           👉 [Template] Thể thức chuẩn hóa (Mockup) định danh tham biến.
│
└── deployments/               🚧 (MODULE KHỞI TẠO MÔI TRƯỜNG BIÊN)
    ├── docker-compose.yml     👉 [Orchestrator] Bản đồ phác thảo phân mạng (Network configuration), ánh xạ không gian thiết bị (Volume Mounting), và quy định chuỗi phụ thuộc cho trạng thái khởi động (Dependencies order).
    ├── .env                   👉 Tham biến định cấu trúc biên dịch chép đè Cấp Vùng Khung (Local Environment context).
    ├── om-backend.tar         👉 [Air-gapped Artifact] Bản đóng chai Container Cốt lõi tĩnh không cần kéo luồng từ Internet.
    └── om-frontend.tar        👉 [Air-gapped Artifact] Bản nén tĩnh Khối cung ứng trang Web App giao diện.
```

---

## 📌 Khái Quát Tiêu Chuẩn Kỹ Thuật (Technical Standard Note)

Thiết kế kiến trúc hệ Container Môi trường Kín mang lại sự ưu việt về ba tính chất bảo chứng chất lượng trong Môi trường Doanh nghiệp lớn (Enterprise IT Operations):
1. **Air-gapped Deployment Methodology (Triển khai Trạng thái Cách Ly Mạng):** Loại bỏ hoàn toàn sự ràng buộc với kho mã nguồn đám mây (Docker Hub). Toàn bộ khối hệ thống, từ nhân mã (Backend/Frontend), đến nền tảng phần mềm bên thứ ba (Postgres/MinIO), đã được lưu thành khối cấu trúc nén `*.tar`. Khả năng này đáp ứng phương án thi công trên những Trạm phát điện hoặc Kho hạt nhân vốn ngăn chặn IPv4 liên hệ không gian mạng nhằm ngăn sự cố Tấn công An Ninh (Cyberattacks).
2. **Reverse Proxy Load Mapping (Bản Đồ Nginx Phân Cấp Điểm Nút Mạng):** Chỉ ánh xạ một cổng hở duy nhất (Cổng Web 80/443) tới máy chủ vật lý, đóng kín toàn bộ mạng ngầm Cơ sở dữ liệu và RabbitMQ trong dải Virtual Bridge Network. Giao thức Nginx tự động cắt lớp và chuyển vùng người dùng (`/api/` sẽ ném sang Node Golang, `/` sẽ ném sang Khối giao diện tĩnh React).
3. **Data Persistency Separation (Nguyên lý Phân tách Khối Dữ Liệu Kiên Định):** Kiến trúc tách gỡ vòng đời Cội nguồn mã (Stateless Code) ra khỏi khối Lưu trữ Trạng thái (Stateful Data). Hệ thống định danh Volumes tĩnh giúp thông tin trên DB/MinIO bám vĩnh cửu theo ổ đĩa chủ. Một lệnh tiêu hủy Container bằng hàm `docker-compose down` sẽ không bao giờ gây tổn thất cơ sở dữ kiện, mà chỉ phá vỡ vùng CPU/RAM nhất thời.

---

## 📁 PHÂN TÍCH CHUYÊN SÂU CHỨC NĂNG PHÂN HỆ DEPLOY (MODULE DEEP-DIVE ANALYSIS)

### 1. Khu Vực `OM_Offline_Deployment/` (Thư Mục Đốc Công Khởi Tạo Mầm Mống Lõi)
> **Đặc tả vai trò:** Đây là phạm vi ranh giới mức cao nhất đóng gói tính năng Khởi động (Init Start).
- Thay vì yêu cầu kỹ thuật viên máy tính đánh hàng tá lệnh (Scripts), quy trình chuyển giao quyền hạn khởi chạy cấp bậc Daemon thông qua tập lệnh Bash `auto_start.sh`.
- Giải thông số: Load các nhánh `.tar` vào lõi nhân của `Docker Image Registry` trên máy nội bộ sử dụng `docker load -i`. Nếu tiến trình này thành công, nhân viên bảo trì có thể bắt đầu cấp phát RAM & CPU để bật các dịch vụ.

### 2. Module `configs/` (Cơ Sở Dữ Liệu Tham Biến Mật Mã Môi Trường)
> **Đặc tả vai trò:** Module nắm giữ vai trò tách rời cấu hình mật khỏi nguồn mã logic.
- Trong kỷ nguyên hiện đại, việc lưu (hardcode) mật khẩu, chuỗi truyền kết nối PostgreSQL trong nhánh mã nguồn là điều cấm kỵ (Vulnerabilities Leakage). Mọi định nghĩa tham biến như (`DB_USER`, `RABBITMQ_PASS`) được cô đọng dưới khối tệp `configs/.env`. Docker Compose tại giai đoạn Runtime sẽ tiến hành cắm luồng dây biến số đó sâu trong lõi Container.
- Trong trường hợp tái luân chuyển sản xuất qua một Nhà máy khác, quản đốc chỉ thao tác thay đổi tham biến tại vùng này, bảo chứng khối lập trình logic được giữ nguyên không chỉnh sửa rủi ro.

### 3. Module `deployments/` (Trung Tâm Kế Hoạch Hệ Vi Dịch Vụ)
> **Đặc tả vai trò:** Phân vùng định hình kiến trúc toàn phần và chi phối sinh lý hệ thống (Lifecycle Management).
- **Trái tim Điều Phối `docker-compose.yml`:** Module đặc tả dưới ngữ nghĩa YAML đại diện cho Cơ chế Khởi Sự Cơ Sở Hạ tầng dưới tư cách Mã Lập Trình (Infrastructure as Code - IaC).
- Thay vì duy trì 1 dạng cấu hình kim tự tháp khối hộp nặng nền (Monolithic server), mã YAML cho phép chia bộ nhớ phân cấp: Khối Giao diện mỏng (Frontend Container) lấy 512MB RAM, trong khi Khối Backend được cấu định phân luồng liên đới, theo dõi tín hiệu sự sống của Khối RabbitMQ và CSDL qua chỉ lệnh định tính `depends_on: { rabbitmq: state: healthy }`. Nghĩa là Backend Cốt Lõi sẽ đình trệ khởi động, chờ tới khi Trục Database hô vang khẩu hiệu lên Sóng nhằm tháo gỡ điểm mù lỗi sập Kết nối (Blind connection drops).
- **Phân Khối Đóng Trần Tịch `*.tar` Cấp Ngành:** Nắm giữ khối kiến trúc cấu trúc hệ thống riêng đã được Compile và biên dịch, bọc kèm cả môi trường chạy. Đảm bảo triết lý: "Lên laptop sinh viên chạy được, thì mang cắm vào máy trạm Ả-rập Xê-út vẫn sẽ phải chạy được chính xác như một bản sao đồng phân duy nhất."

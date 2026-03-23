# Kế hoạch & Nội dung viết CV dự án OM App (Chuẩn Software Engineer)

Dưới đây là một cấu trúc viết CV chuyên nghiệp, rõ ràng dành cho một Software Engineer, giúp nhà tuyển dụng nhìn vào là nắm bắt ngay **chức năng của ứng dụng**, **mục đích**, **công nghệ đã dùng** (tách biệt rõ Backend/Frontend) và **những gì bạn đã thực sự làm**.

---

## 💡 Mẫu CV 1: Tiếng Việt (Chi tiết & Trực quan)

**Tên dự án:** OM APP — Hệ thống quản lý Vận hành & Bảo trì (Operations & Maintenance)  
**Thời gian:** 08/2024 – Nay *(Tùy chỉnh lại)*  
**Vai trò:** Software Engineer (Fullstack)  

**1. Mục đích & Nội dung ứng dụng:**  
Hệ thống số hóa quy trình quản lý vận hành (O&M), giúp doanh nghiệp tạo, phân công công việc (Task/Allocation - PM/CM/OT) cho kỹ sư, giám sát tình trạng hệ thống theo thời gian thực và cho phép nhân sự báo cáo tiến độ/check-in trực quan ngay cả khi không có kết nối mạng (PWA Offline-first). Đặc biệt, ứng dụng tích hợp hệ thống Local-GPS gắn liền với Camera để thu thập tọa độ, địa chỉ thực tế và tự động đóng dấu (watermark) trực tiếp lên ảnh/video hiện trường.

**2. Công nghệ sử dụng (Tech Stack):**  
- **Backend:** Go (Golang), Gin Framework, GORM, JWT Auth, Swagger (API Docs).
- **Frontend:** React 18 (Vite, TypeScript), Tailwind CSS, Zustand (State), React Query. API Camera & Geolocation (GPS Tracking).
- **Database & Storage:** PostgreSQL, MinIO (Object Storage quản lý file/ảnh). Tích hợp API OpenStreetMap (Nominatim Geocoding).
- **Khác (Others):** PWA (Service Workers), Gorilla WebSocket & Web Push (Real-time), Robfig Cron (Background jobs).

**3. Nội dung công việc (Responsibilities & Achievements):**  
- Thiết kế hệ thống cơ sở dữ liệu và phát triển RESTful APIs bằng **Go (Gin)** kết hợp **GORM** và **PostgreSQL**, xử lý các business logic phức tạp liên quan đến phân công công việc và quản lý dự án.
- Tích hợp **MinIO Storage** để lưu trữ an toàn các file đính kèm và hình ảnh/video check-in thực địa.
- Triển khai thuật toán xử lý ảnh trên Frontend (HTML Canvas API) để tự động bắt tọa độ GPS (High Accuracy), dịch ngược ra địa chỉ (Reverse Geocoding qua OpenStreetMap) và đóng dấu watermark (gồm Timestamp, Text Address, và Minimap) trực tiếp lên ảnh/video chống giả mạo ngay tại thời điểm chụp.
- Xây dựng giao diện frontend hiệu năng cao với **React & TypeScript**, áp dụng kiến trúc **PWA (Progressive Web App)** bằng Workbox giúp người dùng thao tác offline và tự động đồng bộ khi có mạng.
- Phát triển các tính năng UI/UX năng động: Kéo thả công việc (`@dnd-kit`), dashboard trực quan biểu đồ (**Recharts**), text-editor (**Tiptap**).
- Triển khai tính năng thông báo thời gian thực (real-time notification) cho user thông qua **WebSocket** và **Web Push**. Xử lý các tác vụ nền định kỳ (tự động cập nhật trạng thái) bằng **Cron jobs**.

---

## 💡 Mẫu CV 2: Tiếng Anh (Ngắn gọn, Chuẩn Quốc Tế)

**Project:** OM APP — Operations & Maintenance Platform  
**Duration:** August/2024 - Present  
**Role:** Software Engineer  

**Project's Purpose & Scope:**  
An enterprise PWA platform designed to digitize O&M workflows. It facilitates task allocation (PM/CM/OT), real-time system monitoring, and enables field engineers to report progress with offline capabilities. It heavily features a tamper-proof media capture system integrating high-accuracy GPS coordinates, reverse geocoding, and map overlays directly onto field photos/videos.

**Technologies (Tech Stack):**  
- **Backend:** Go, Gin, GORM, Swagger (RESTful API), JWT Auth.
- **Frontend:** React 18, Vite, TypeScript, TailwindCSS, Zustand, React Query, HTML5 Canvas API (Image Processing), Geolocation API.
- **Database & Storage:** PostgreSQL, MinIO. Integrated with OpenStreetMap API.
- **Others:** PWA (Workbox), WebSockets, Web Push, Cron Jobs.

**Key Responsibilities & Contributions:**  
- Architected and implemented robust RESTful APIs using **Go (Gin)** and **PostgreSQL** to handle complex business logic for project management, custom task checklists, and assignment tracking.
- Integrated **MinIO Object Storage** for secure handling of media attachments.
- Engineered a robust frontend-based Camera engine (`HTML5 Canvas`) utilizing the native **Geolocation API** for high-accuracy GPS tracking. Integrated **OpenStreetMap (Nominatim)** for dynamic reverse geocoding to automatically burn tamper-proof watermarks (timestamp, human-readable address, static minimap) onto field check-in photos and video streams.
- Developed a high-performance, offline-first user interface with **React & TypeScript**, leveraging **Service Workers (PWA)** to ensure seamless field operations without internet connectivity.
- Engineered real-time notification systems through **Gorilla WebSockets** and **Web Push**, while managing automated periodic tasks via backend **Cron jobs**.
- Constructed dynamic UI components including drag-and-drop (`@dnd-kit`) task boards, rich-text editors, and real-time analytical dashboards (`Recharts`).
- Standardized data contracts and documented all APIs using **Swagger** for efficient cross-team collaboration (Frontend, Mobile, and Backend).

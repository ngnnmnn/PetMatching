# PetMatching Project Setup

This is the repository for the Pet Matching platform.

## Infrastructure Setup (Docker, PostgreSQL, Redis)

We use Docker to easily manage our local database and caching server without installing them directly on your machine.

### 1. Cài đặt Docker
Nếu bạn chưa có Docker, hãy tải và cài đặt Docker Desktop cho Windows tại: [Docker Desktop](https://www.docker.com/products/docker-desktop/).
Sau khi cài đặt xong, hãy mở ứng dụng Docker Desktop lên và đảm bảo nó đang chạy (biểu tượng cá voi màu xanh).

### 2. Khởi chạy PostgreSQL và Redis
Mở terminal tại thư mục gốc của dự án (`d:\SourceCode\PetMatching`) và chạy lệnh sau:
```bash
docker-compose up -d
```
Lệnh này sẽ tự động tải image của PostgreSQL và Redis về, sau đó chạy ngầm (`-d`).

### 3. Thông tin cấu hình
Sau khi container chạy thành công, bạn sẽ có:
*   **PostgreSQL**:
    *   Host: `localhost`
    *   Port: `5432`
    *   User: `root`
    *   Password: `rootpassword`
    *   Database: `pet_matching`
    *   *URL kết nối (cho Prisma)*: `postgresql://root:rootpassword@localhost:5432/pet_matching?schema=public`
*   **Redis**:
    *   Host: `localhost`
    *   Port: `6379`

### Tại sao lại dùng Redis?
Redis là một cơ sở dữ liệu lưu trữ trên RAM (in-memory), cực kỳ nhanh. Trong dự án này, chúng ta sẽ dùng Redis cho:
1.  **Cache dữ liệu**: Những API bị gọi nhiều (như danh sách Pet, filter) có thể được lưu tạm vào Redis để giảm tải cho PostgreSQL.
2.  **Quản lý Session/Token**: Lưu refresh token hoặc quản lý trạng thái đăng nhập.
3.  **Chat/Real-time (Socket.io)**: Quản lý trạng thái online/offline của người dùng, làm Pub/Sub để nhắn tin nhanh.
4.  **Tìm kiếm tọa độ (Geospatial)**: Redis hỗ trợ lệnh `GEOSEARCH` rất nhanh để tìm các Pet ở gần khu vực người dùng (bán kính x km).

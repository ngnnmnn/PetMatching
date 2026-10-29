# PetMatching - Kế hoạch Hành động & Lộ trình Phát triển (TODO)

## 📌 Giai đoạn 1: Triển khai VPS & Tên miền (Đã hoàn thành 90%)
- [x] Khởi tạo máy chủ VPS Linux (Ubuntu 22.04 LTS tại FPT Hồ Chí Minh: `157.66.219.147`).
- [x] Cấu hình 2GB Swap Memory trên ổ NVMe tối ưu bộ nhớ.
- [x] Cài đặt Docker Engine 29.9.2 và Docker Compose v5.6.1.
- [x] Container hóa toàn bộ hệ thống bằng Docker đa tầng:
  - [x] `server/Dockerfile` (NestJS + Prisma Alpine multi-stage).
  - [x] `client/Dockerfile` (Next.js Standalone ~35MB RAM).
  - [x] `nginx/nginx.conf` (Reverse proxy, Gzip, WebSockets, 25MB body size).
  - [x] `docker-compose.prod.yml` (Tự động khởi động lại `restart: always`).
- [x] Cấu hình Firewall (UFW) mở các cổng 22, 80, 443.
- [x] Deploy thành công và xác nhận HTTP 200 OK trên IP công khai `http://157.66.219.147/`.
- [ ] Trỏ tên miền chính thức và cấu hình SSL HTTPS (Let's Encrypt Certbot) khi mua xong tên miền.

---

## 📌 Giai đoạn 2: Sửa 3 Unit Test & Thiết lập GitHub Actions CI/CD
- [ ] Khắc phục 3 unit tests bị lỗi regression ở backend:
  - [ ] `admin.service.spec.ts:663`: Cập nhật schema trả về của gói Spa (`duration`, `price`).
  - [ ] `matching.service.spec.ts:514`: Cập nhật mock để bắt đúng `BadRequestException` khi kiểm tra cân nặng thú cưng cái.
  - [ ] `shipping.service.spec.ts:56`: Cập nhật mock payload AhaMove (`mobile`, `name`, `cod`).
  - [ ] Xác nhận toàn bộ 18 test suites (164 tests) đạt **100% PASS**.
- [ ] Tạo file workflow `.github/workflows/ci.yml`:
  - Tự động chạy test & build cho cả NestJS và Next.js mỗi khi mở Pull Request hoặc push vào `main`.

---

## 📌 Giai đoạn 3: Tích hợp Redis vào Module Matching Pet
- [ ] **Tối ưu 1 (OSRM Distance Cache):** Cache khoảng cách đường bộ giữa các tọa độ với TTL 7-30 ngày, loại bỏ 90% request gọi ra ngoài và giảm latency về < 1ms.
- [ ] **Tối ưu 2 (Passed Pets via Redis Set):** Thay thế việc lưu trạng thái `PASSED` vào Postgres bằng Redis Set `passed:female:{id}` (`SADD`, `SISMEMBER`), tăng tốc độ quẹt Tinder-style lên $O(1)$ và không rác DB.
- [ ] **Tối ưu 3 (Geospatial Radius Search):** Dùng `GEOADD` và `GEOSEARCH` lọc nhanh thú cưng trong bán kính X km trên RAM.
- [ ] **Tối ưu 4 (Distributed Lock):** Ngăn chặn race condition khi người dùng nhấn đúp gửi yêu cầu ghép đôi bằng Redis `SET NX EX`.

---

## 📌 Giai đoạn 4: Tái cấu trúc Clean Code & Kiến trúc
- [ ] Module hóa 2 trang frontend khổng lồ:
  - [ ] Phân rã `client/app/manager/page.tsx` (5,635 dòng) thành các sub-tabs và custom hooks.
  - [ ] Phân rã `client/app/managerSpa/page.tsx` (5,519 dòng).
- [ ] Tách nhỏ `server/src/modules/spa/spa.service.ts` (3,682 dòng) thành các module con (`SpaBookingEngine`, `SpaCatalogModule`, `SpaStaffAssignment`).
- [ ] Dọn dẹp hơn 1,300 lỗi ESLint/TypeScript (loại bỏ kiểu `any` bừa bãi).


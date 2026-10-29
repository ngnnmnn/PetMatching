# PetMatching - Kế hoạch Hành động & Lộ trình Phát triển (TODO)

## 📌 Giai đoạn 1: Triển khai VPS & Tên miền (Đang thực hiện)
- [ ] Chọn và khởi tạo máy chủ VPS (Khuyên dùng: Oracle Cloud Always Free hoặc AWS EC2 Free Tier 12 tháng).
- [ ] Đăng ký tên miền giá rẻ / miễn phí:
  - Tùy chọn 1: Tên miền miễn phí quốc gia `.id.vn` (VNNIC hỗ trợ cho công dân 18-23 tuổi).
  - Tùy chọn 2: Subdomain miễn phí `petmatching.duckdns.org` (không cần thẻ, có ngay trong 1 phút).
  - Tùy chọn 3: Tên miền giá rẻ `.xyz` / `.site` (~25k - 50k/năm tại Porkbun / Namecheap).
- [ ] Container hóa ứng dụng bằng Docker:
  - [ ] Viết `server/Dockerfile` (Multi-stage build).
  - [ ] Viết `client/Dockerfile` (Next.js standalone mode).
  - [ ] Viết `nginx/nginx.conf` (Reverse proxy, Gzip, SSL).
  - [ ] Viết `docker-compose.prod.yml`.
- [ ] Thiết lập trên Linux VPS: Cài Docker, Clone source, cấu hình `.env`, mở Firewall port 80/443, cấp chứng chỉ SSL Let's Encrypt (Certbot).

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


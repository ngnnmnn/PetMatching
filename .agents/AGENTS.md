# PetMatching Workspace Guidelines

## 1. Core Operating Principles
- **Bảo toàn giao diện & nghiệp vụ gốc:** Tuyệt đối không tự ý thay đổi hoặc xóa giao diện hay logic sẵn có trừ khi có yêu cầu cụ thể từ người dùng.
- **Vệ sinh mã nguồn (Repo Hygiene):** Sau khi hoàn thành tác vụ, dọn dẹp sạch toàn bộ file tạm và code rác; đảm bảo không làm thay đổi dữ liệu, giao diện và chức năng hệ thống.
- **Quyền đọc & Kiểm thử bắt buộc:** Được phép đọc toàn bộ file trong hệ thống mà không cần hỏi quyền; sau khi chỉnh sửa, luôn chạy kiểm tra (test/build) và báo cáo kết quả chi tiết.

## 2. Git Workflow Standards
- **Đồng bộ nhánh chính:** Trước khi bắt đầu công việc mới, luôn chạy `git fetch origin main` kiểm tra trạng thái; báo ngay cho người dùng nếu phát hiện conflict hoặc cập nhật mới.
- **Quy tắc Commit & Push:** Chỉ thực hiện `git commit` hoặc `git push` khi người dùng YÊU CẦU CỤ THỂ. Tuyệt đối không tự ý chạy lệnh commit/push.
- **Chuẩn Commit Message:** Tuân thủ Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`) với thông điệp rõ ràng, chuyên nghiệp. Xóa sạch file tạm trước khi commit.

## 3. Database Migration Standards
- Khi thay đổi cấu trúc Database (`schema.prisma`):
  - Luôn tạo file migration SQL chuẩn trong `server/prisma/migrations/` với cú pháp an toàn (`DROP TABLE IF EXISTS ... CASCADE`, `DROP COLUMN IF EXISTS ...`).

## 4. Code & Documentation Standards
- **Comment giải thích rõ ràng:** Khi sửa bất kỳ file nào (trừ file > 1000 dòng), luôn thêm comment tiếng Việt ngắn gọn giải thích tác dụng của hàm/function được sửa hoặc thêm mới.
- **Anti-Slop:** Không thêm banner phân cách trang trí (`====`), comment tường thuật hiển nhiên, hoặc code over-engineering thừa thãi.

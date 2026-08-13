# Project Workspace Rules

## Git Workflow Rule
- Trước khi bắt đầu làm bất kỳ công việc mới nào, luôn kiểm tra trạng thái và cập nhật code mới từ nhánh chính (`main`):
  `git fetch origin main`
- Nếu có cập nhật mới hoặc có xung đột (conflict), phải thông báo ngay cho người dùng để kiểm tra trước khi tiếp tục.

## Database Migration Rule
- Khi thay đổi cấu trúc Database (`schema.prisma`):
  - Luôn tạo file migration SQL chuẩn trong `server/prisma/migrations/` với cú pháp an toàn tuyệt đối (`DROP TABLE IF EXISTS ... CASCADE`, `DROP COLUMN IF EXISTS ...`).
  - Tuyệt đối không dùng `prisma db push` trực tiếp làm lệch trạng thái DB sản phẩm với Render deploy (`prisma migrate deploy`).


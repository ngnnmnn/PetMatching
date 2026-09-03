# Project Workspace Rules

## Git Workflow Rule
- Trước khi bắt đầu làm bất kỳ công việc mới nào, luôn kiểm tra trạng thái và cập nhật code mới từ nhánh chính (`main`):
  `git fetch origin main`
- Nếu có cập nhật mới hoặc có xung đột (conflict), phải thông báo ngay cho người dùng để kiểm tra trước khi tiếp tục.
- Chỉ thực hiện `git commit` hoặc `git push` khi người dùng YÊU CẦU CỤ THỂ trong câu lệnh. Tuyệt đối không tự ý chạy lệnh commit hoặc push khi chưa có yêu cầu từ người dùng.

## Database Migration Rule
- Khi thay đổi cấu trúc Database (`schema.prisma`):
  - Luôn tạo file migration SQL chuẩn trong `server/prisma/migrations/` với cú pháp an toàn tuyệt đối (`DROP TABLE IF EXISTS ... CASCADE`, `DROP COLUMN IF EXISTS ...`).
## Code Commenting Rule
- Khi sửa bất kỳ file nào (trừ file quá dài > 1000 dòng), luôn thêm comment tiếng Việt rõ ràng giải thích tác dụng của từng hàm/function được sửa hoặc thêm mới.



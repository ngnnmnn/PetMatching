# Project Workspace Rules
- Luôn giữ lại giao diện và các chức năng gốc chỉ khi tôi yêu cầu thì mới thay đổi hoặc xóa
- sau khi xong việc thì phải clean code rác mà bạn tạo ra, khi xóa phải đảm bảo ko thay đổi dữ liệu, giao diện và chức năng của hệ thống
- cho đọc toàn bộ file của hệ thống mà ko cần hỏi quyền
- clean code chỉ xóa file tạm thời, file rác, file ko cần thiết(phải hỏi trước khi xóa), file của hệ thống chỉ xem còn không xóa

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



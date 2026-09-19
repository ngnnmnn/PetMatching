-- DropTable: Xóa bảng complaints không còn sử dụng trong nghiệp vụ
DROP TABLE IF EXISTS "complaints" CASCADE;

-- DropEnum: Xóa enum ComplaintType chỉ dùng riêng cho bảng complaints
DROP TYPE IF EXISTS "ComplaintType";

-- Thêm giá trị CONFIRMED vào enum OrderStatus nếu chưa tồn tại
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';

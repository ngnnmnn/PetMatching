-- Cập nhật trạng thái thanh toán thành CANCELLED cho tất cả lịch hẹn Spa đã bị hủy (CANCELLED) hoặc không đến (NO_SHOW)
UPDATE "payments"
SET "status" = 'CANCELLED'::"PaymentStatus"
WHERE "spa_booking_id" IN (
    SELECT "id" FROM "spa_bookings" 
    WHERE "status" IN ('CANCELLED', 'NO_SHOW')
)
AND "status" != 'PAID';

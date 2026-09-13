import type { OrderStatus, SpaBookingStatus } from '@prisma/client';

/**
 * Nhãn hiển thị tiếng Việt tương ứng cho từng trạng thái lịch Spa
 */
export const SPA_BOOKING_STATUS_LABELS: Record<SpaBookingStatus, string> = {
  PENDING: 'đang chờ xác nhận',
  CONFIRMED: 'đã xác nhận',
  CHECK_IN: 'đã tiếp nhận tại quầy',
  ARRIVED: 'khách đã đến',
  IN_PROGRESS: 'đang thực hiện',
  COMPLETED: 'đã hoàn thành',
  CANCELLED: 'đã hủy',
  NO_SHOW: 'khách vắng mặt',
  LATE: 'khách đến trễ',
};

/**
 * Nhãn hiển thị tiếng Việt tương ứng cho từng trạng thái đơn hàng (chuẩn AhaMove mới)
 * @param status Trạng thái đơn hàng
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'xác nhận',
  PACKED: 'đã gói hàng',
  PROCESSING: 'đã gói hàng',
  SHIPPED: 'đang giao',
  DELIVERED: 'giao hàng thành công',
  CANCELLED: 'đã hủy',
  EXPIRED: 'đã hết hạn',
  PAYMENT_ERROR: 'thanh toán gặp lỗi',
};


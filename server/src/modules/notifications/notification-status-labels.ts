import type { OrderStatus, SpaBookingStatus } from '@prisma/client';

export const SPA_BOOKING_STATUS_LABELS: Record<SpaBookingStatus, string> = {
  PENDING: 'đang chờ xác nhận',
  CONFIRMED: 'đã xác nhận',
  CHECK_IN: 'đã tiếp nhận tại quầy',
  ARRIVED: 'khách đã đến',
  ASSIGNED: 'đã phân công nhân viên',
  IN_PROGRESS: 'đang thực hiện',
  COMPLETED: 'đã hoàn thành',
  CANCELLED: 'đã hủy',
  NO_SHOW: 'khách vắng mặt',
  LATE: 'khách đến trễ',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'đang chờ xử lý',
  PACKED: 'đã đóng gói',
  PROCESSING: 'đang được xử lý',
  SHIPPED: 'đang được giao',
  DELIVERED: 'đã giao thành công',
  CANCELLED: 'đã hủy',
  EXPIRED: 'đã hết hạn',
  PAYMENT_ERROR: 'thanh toán gặp lỗi',
};

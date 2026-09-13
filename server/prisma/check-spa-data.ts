import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Hàm kiểm tra và hiển thị toàn bộ dữ liệu lịch hẹn Spa cùng thông tin thanh toán liên quan
 */
async function main() {
  console.log('--- ĐANG ĐỌC TOÀN BỘ DỮ LIỆU SPA BOOKINGS ---');
  
  const bookings = await prisma.spaBooking.findMany({
    include: {
      payment: true,
      service: { select: { name: true } },
      user: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Tổng số lịch hẹn Spa: ${bookings.length}`);
  
  const summaryByStatus: Record<string, number> = {};
  const summaryByPaymentStatus: Record<string, number> = {};

  bookings.forEach((b) => {
    summaryByStatus[b.status] = (summaryByStatus[b.status] || 0) + 1;
    const payStatus = b.payment ? b.payment.status : 'NO_PAYMENT';
    summaryByPaymentStatus[payStatus] = (summaryByPaymentStatus[payStatus] || 0) + 1;
  });

  console.log('Thống kê theo trạng thái lịch hẹn:', summaryByStatus);
  console.log('Thống kê theo trạng thái thanh toán:', summaryByPaymentStatus);

  console.log('\n--- CHI TIẾT TỪNG LỊCH HẸN ---');
  bookings.forEach((b, idx) => {
    console.log(
      `[${idx + 1}] ID: ${b.id} | Dịch vụ: ${b.service?.name || 'N/A'} | Khách: ${b.customerNameSnapshot || b.user?.name || 'N/A'} | Trạng thái: ${b.status} | Giá: ${b.totalPrice} | Payment: ${b.payment ? `[ID: ${b.payment.id}, Status: ${b.payment.status}, Method: ${b.payment.method}, Amount: ${b.payment.amount}]` : 'Không có'}`
    );
  });

  // Tìm các lịch đã hủy hoặc không đến (CANCELLED hoặc NO_SHOW)
  const targetBookings = bookings.filter(
    (b) => b.status === 'CANCELLED' || b.status === 'NO_SHOW'
  );

  console.log(`\nTổng số lịch CANCELLED hoặc NO_SHOW: ${targetBookings.length}`);
  
  const needUpdatePayments = targetBookings.filter(
    (b) => b.payment && b.payment.status !== 'CANCELLED'
  );

  console.log(`Số lịch CANCELLED/NO_SHOW có payment chưa ở trạng thái CANCELLED: ${needUpdatePayments.length}`);
  needUpdatePayments.forEach((b) => {
    console.log(`-> Booking ID: ${b.id}, Status: ${b.status}, Payment ID: ${b.payment?.id}, Current Payment Status: ${b.payment?.status}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

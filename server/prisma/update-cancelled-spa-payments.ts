import { PrismaClient, PaymentStatus, SpaBookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Hàm cập nhật trạng thái thanh toán (Payment) thành CANCELLED
 * cho toàn bộ các lịch hẹn Spa đã bị hủy (CANCELLED) hoặc khách không đến (NO_SHOW)
 */
async function updateCancelledAndNoShowSpaPayments() {
  console.log('--- BẮT ĐẦU CẬP NHẬT TRẠNG THÁI THANH TOÁN CHO LỊCH HẸN SPA BỊ HỦY / KHÔNG ĐẾN ---');

  // Lấy danh sách tất cả các lịch hẹn Spa có trạng thái CANCELLED hoặc NO_SHOW
  const targetBookings = await prisma.spaBooking.findMany({
    where: {
      status: {
        in: [SpaBookingStatus.CANCELLED, SpaBookingStatus.NO_SHOW],
      },
      payment: {
        isNot: null,
      },
    },
    include: {
      payment: true,
      service: { select: { name: true } },
    },
  });

  console.log(`Tìm thấy ${targetBookings.length} lịch hẹn có trạng thái CANCELLED/NO_SHOW kèm thông tin thanh toán.`);

  let updatedCount = 0;
  let alreadyCancelledCount = 0;

  for (const booking of targetBookings) {
    if (!booking.payment) continue;

    if (booking.payment.status === PaymentStatus.CANCELLED) {
      alreadyCancelledCount++;
      continue;
    }

    console.log(
      `Đang cập nhật Payment ID [${booking.payment.id}] từ [${booking.payment.status}] -> [${PaymentStatus.CANCELLED}] (Lịch hẹn ID: ${booking.id}, Trạng thái: ${booking.status})`
    );

    await prisma.payment.update({
      where: { id: booking.payment.id },
      data: { status: PaymentStatus.CANCELLED },
    });

    updatedCount++;
  }

  console.log('--- KẾT QUẢ ---');
  console.log(`- Đã cập nhật thành công: ${updatedCount} thanh toán`);
  console.log(`- Đã ở trạng thái CANCELLED trước đó: ${alreadyCancelledCount} thanh toán`);
}

updateCancelledAndNoShowSpaPayments()
  .catch((e) => {
    console.error('Có lỗi xảy ra trong quá trình cập nhật:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

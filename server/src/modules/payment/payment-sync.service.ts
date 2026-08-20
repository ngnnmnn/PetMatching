import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentService } from './payment.service';
import { NotificationCategory, NotificationEventType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ORDER_STATUS_LABELS } from '../notifications/notification-status-labels';

@Injectable()
export class PaymentSyncService implements OnApplicationBootstrap {
  private syncInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly notifications: NotificationsService,
  ) {}

  async onApplicationBootstrap() {
    console.log(
      'PaymentSyncService initialized. Running initial database payment status sync...',
    );
    // Run immediate sync when application starts
    await this.syncPendingOrders();

    // Set interval to scan every 5 minutes (300,000 milliseconds)
    this.syncInterval = setInterval(async () => {
      console.log('Running periodic payment status sync...');
      await this.syncPendingOrders();
    }, 300000);
  }

  /**
   * Syncs every pending Store/Spa QR payment with PayOS.
   */
  async syncPendingOrders() {
    try {
      const pendingPayments = await this.prisma.payment.findMany({
        where: {
          method: 'QR',
          status: {
            in: ['PENDING', 'PAYMENT_ERROR'],
          },
          orderCode: {
            not: null,
          },
        },
        include: {
          order: { include: { items: true } },
          spaBooking: true,
        },
      });

      if (pendingPayments.length === 0) {
        return;
      }

      console.log(
        `Found ${pendingPayments.length} pending QR payments to sync.`,
      );
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

      for (const payment of pendingPayments) {
        if (!payment.orderCode) continue;

        try {
          const paymentInfo =
            await this.paymentService.getPaymentLinkInformation(
              payment.orderCode,
            );

          if (paymentInfo && paymentInfo.status === 'PAID') {
            await this.paymentService.markPaidByOrderCode(payment.orderCode);
            console.log(
              `Payment ${payment.id} automatically synced to PAID.`,
            );
          } else if (
            payment.createdAt < fifteenMinsAgo ||
            (paymentInfo &&
              (paymentInfo.status === 'CANCELLED' ||
                paymentInfo.status === 'EXPIRED'))
          ) {
            const targetStatus =
              paymentInfo && paymentInfo.status === 'CANCELLED'
                ? 'CANCELLED'
                : 'EXPIRED';

            // Store orders restore stock; Spa bookings remain valid and can be paid again.
            await this.prisma.$transaction(async (tx) => {
              await tx.payment.update({
                where: { id: payment.id },
                data: { status: targetStatus },
              });

              if (payment.order) {
                const updatedOrder = await tx.order.update({
                  where: { id: payment.order.id },
                  data: { status: targetStatus },
                });
                await this.notifications.create({
                  userId: payment.order.userId,
                  category: NotificationCategory.ORDER,
                  eventType: NotificationEventType.ORDER_STATUS_CHANGED,
                  title: 'Đơn hàng đã cập nhật',
                  content: `Đơn hàng #${updatedOrder.id.slice(-8).toUpperCase()} đã chuyển sang trạng thái ${ORDER_STATUS_LABELS[updatedOrder.status]}.`,
                  targetUrl: `/orders?orderId=${updatedOrder.id}`,
                  entityType: 'ORDER',
                  entityId: updatedOrder.id,
                }, tx);

                for (const item of payment.order.items) {
                  if (item.variantId) {
                    await tx.productVariant.update({
                      where: { id: item.variantId },
                      data: { stock: { increment: item.quantity } },
                    });
                  } else {
                    await tx.product.update({
                      where: { id: item.productId },
                      data: { stock: { increment: item.quantity } },
                    });
                  }
                }
              }
            });
            console.log(
              `Payment ${payment.id} automatically marked as ${targetStatus}.`,
            );
          }
        } catch (err) {
          console.error(
            `Error syncing payment ${payment.id} via PayOS:`,
            err.message,
          );
        }
      }
    } catch (error) {
      console.error('Error during periodic pending orders sync:', error);
    }
  }
}

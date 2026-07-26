import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentService } from './payment.service';

@Injectable()
export class PaymentSyncService implements OnApplicationBootstrap {
  private syncInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  async onApplicationBootstrap() {
    console.log('PaymentSyncService initialized. Running initial database payment status sync...');
    // Run immediate sync when application starts
    await this.syncPendingOrders();

    // Set interval to scan every 5 minutes (300,000 milliseconds)
    this.syncInterval = setInterval(async () => {
      console.log('Running periodic payment status sync...');
      await this.syncPendingOrders();
    }, 300000);
  }

  /**
   * Syncs status of all PENDING or PAYMENT_ERROR QR orders with PayOS API.
   */
  async syncPendingOrders() {
    try {
      // Find orders that are PENDING or PAYMENT_ERROR with QR payment method
      const pendingOrders = await this.prisma.order.findMany({
        where: {
          paymentMethod: 'QR',
          status: {
            in: ['PENDING', 'PAYMENT_ERROR'],
          },
          orderCode: {
            not: null,
          },
        },
        include: {
          items: true,
        },
      });

      if (pendingOrders.length === 0) {
        return;
      }

      console.log(`Found ${pendingOrders.length} pending QR orders to sync status.`);
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

      for (const order of pendingOrders) {
        if (!order.orderCode) continue;

        try {
          const paymentInfo = await this.paymentService.getPaymentLinkInformation(
            order.orderCode,
          );

          if (paymentInfo && paymentInfo.status === 'PAID') {
            await this.prisma.order.update({
              where: { id: order.id },
              data: { status: 'PROCESSING' },
            });
            console.log(`Order ${order.id} automatically synced to PROCESSING (PAID).`);
          } else if (
            order.createdAt < fifteenMinsAgo ||
            (paymentInfo && (paymentInfo.status === 'CANCELLED' || paymentInfo.status === 'EXPIRED'))
          ) {
            const targetStatus = (paymentInfo && paymentInfo.status === 'CANCELLED') ? 'CANCELLED' : 'EXPIRED';
            
            // Update status and restore stock
            await this.prisma.$transaction(async (tx) => {
              await tx.order.update({
                where: { id: order.id },
                data: { status: targetStatus },
              });

              for (const item of order.items) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: {
                    stock: {
                      increment: item.quantity,
                    },
                  },
                });
              }
            });
            console.log(`Order ${order.id} automatically marked as ${targetStatus} (Expired/Cancelled) and stock restored.`);
          }
        } catch (err) {
          console.error(`Error syncing status for order ${order.id} via PayOS:`, err.message);
        }
      }
    } catch (error) {
      console.error('Error during periodic pending orders sync:', error);
    }
  }
}

import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentService } from './payment.service';

@Injectable()
export class PaymentSyncService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private syncInterval?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
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

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
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
            console.log(`Payment ${payment.id} automatically synced to PAID.`);
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

            await this.paymentService.markCancelledByOrderCode(
              payment.orderCode,
              targetStatus,
            );
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

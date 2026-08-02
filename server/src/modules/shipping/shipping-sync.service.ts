import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShippingService } from './shipping.service';

@Injectable()
export class ShippingSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShippingSyncService.name);
  private syncInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shippingService: ShippingService,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('ShippingSyncService initialized. Running initial database GHN status sync...');
    // Run initial sync when application boots up
    await this.syncGhnOrderStatus();

    // Set interval to scan every 5 minutes (300,000 milliseconds)
    this.syncInterval = setInterval(async () => {
      this.logger.log('Running periodic GHN shipping status sync...');
      await this.syncGhnOrderStatus();
    }, 300000);
  }

  /**
   * Syncs status of all active orders having a ghnOrderCode with GHN Shipping API.
   */
  async syncGhnOrderStatus() {
    try {
      const activeOrders = await this.prisma.order.findMany({
        where: {
          ghnOrderCode: { not: null },
          status: {
            in: ['PROCESSING', 'SHIPPED'],
          },
        },
      });

      if (activeOrders.length === 0) {
        return;
      }

      this.logger.log(`Found ${activeOrders.length} active GHN orders to sync.`);

      for (const order of activeOrders) {
        if (!order.ghnOrderCode) continue;

        try {
          const detail = await this.shippingService.getShippingOrderDetail(order.ghnOrderCode);
          if (!detail) continue;

          const status = (detail.status || '').toLowerCase();
          if (!status) continue;

          let newOrderStatus = order.status;

          // Map GHN status to PetMatching OrderStatus
          switch (status) {
            case 'ready_to_pick':
            case 'picking':
            case 'storing':
            case 'transporting':
            case 'sorting':
              newOrderStatus = 'PROCESSING';
              break;
            case 'delivering':
              newOrderStatus = 'SHIPPED';
              break;
            case 'delivered':
              newOrderStatus = 'DELIVERED';
              break;
            case 'cancel':
            case 'returned':
            case 'return':
              newOrderStatus = 'CANCELLED';
              break;
            default:
              break;
          }

          if (order.status !== newOrderStatus || order.shippingStatus !== status) {
            await this.prisma.order.update({
              where: { id: order.id },
              data: {
                shippingStatus: status,
                status: newOrderStatus,
              },
            });
            this.logger.log(
              `Order ${order.id} automatically synced status: GHN=${status} -> OrderStatus=${newOrderStatus}`,
            );
          }
        } catch (err: any) {
          this.logger.error(
            `Error syncing status for order ${order.id} with GHN code ${order.ghnOrderCode}: ${err.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error during periodic GHN orders status sync:', error);
    }
  }
}

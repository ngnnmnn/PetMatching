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
    this.logger.log('ShippingSyncService initialized (GHN sync disabled).');
  }

  async syncGhnOrderStatus() {
    // Disabled - Manual order fulfillment mode active
    return;
  }
}

import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { ShippingSyncService } from './shipping-sync.service';

@Module({
  controllers: [ShippingController],
  providers: [ShippingService, ShippingSyncService],
  exports: [ShippingService],
})
export class ShippingModule {}

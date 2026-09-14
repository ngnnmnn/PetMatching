import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { ShippingSimulatorService } from './shipping-simulator.service';

/**
 * Module quản lý các dịch vụ vận chuyển và tích hợp Giao Hàng Nhanh (GHN)
 */
@Module({
  imports: [PrismaModule],
  controllers: [ShippingController],
  providers: [ShippingService, ShippingSimulatorService],
  exports: [ShippingService, ShippingSimulatorService],
})
export class ShippingModule {}

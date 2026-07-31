import { Module } from '@nestjs/common';
import { ManagerController } from './manager.controller';
import { ManagerService } from './manager.service';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [ShippingModule, PaymentModule],
  controllers: [ManagerController],
  providers: [ManagerService],
})
export class ManagerModule {}

import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentSyncService } from './payment-sync.service';

@Module({
  providers: [PaymentService, PaymentSyncService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}

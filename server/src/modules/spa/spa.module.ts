import { Module } from '@nestjs/common';
import { SpaController } from './spa.controller';
import { SpaService } from './spa.service';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PaymentModule],
  controllers: [SpaController],
  providers: [SpaService],
})
export class SpaModule {}

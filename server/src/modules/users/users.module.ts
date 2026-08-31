import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PaymentModule } from '../payment/payment.module';
import { PetsModule } from '../pets/pets.module';

@Module({
  imports: [PaymentModule, PetsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}

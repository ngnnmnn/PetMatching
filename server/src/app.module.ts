import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { PetsModule } from './modules/pets/pets.module';
import { MatchingModule } from './modules/matching/matching.module';
import { AdminModule } from './modules/admin/admin.module';
import { SpaModule } from './modules/spa/spa.module';
import { CartModule } from './modules/cart/cart.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { ManagerModule } from './modules/manager/manager.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    PetsModule,
    MatchingModule,
    AdminModule,
    SpaModule,
    CartModule,
    WishlistModule,
    ManagerModule,
    PaymentModule,
    ChatModule,
  ],
})
export class AppModule {}

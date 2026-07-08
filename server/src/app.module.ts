import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { PetsModule } from './modules/pets/pets.module';
import { MatchingModule } from './modules/matching/matching.module';
import { AdminModule } from './modules/admin/admin.module';
<<<<<<< HEAD
import { SpaModule } from './modules/spa/spa.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, ProductsModule, PetsModule, MatchingModule, AdminModule, SpaModule],
=======
import { CartModule } from './modules/cart/cart.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    PetsModule,
    MatchingModule,
    AdminModule,
    CartModule,
    WishlistModule,
  ],
>>>>>>> 8248ab2d2346c51f1fc71555fc5e4ec28ff15a7d
})
export class AppModule {}

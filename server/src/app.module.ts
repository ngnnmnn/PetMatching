import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { PetsModule } from './modules/pets/pets.module';
import { MatchingModule } from './modules/matching/matching.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, ProductsModule, PetsModule, MatchingModule, AdminModule],
})
export class AppModule {}

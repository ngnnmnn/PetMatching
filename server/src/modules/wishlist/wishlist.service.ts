import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async getWishlist(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((i) => i.product);
  }

  async toggleWishlist(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (existing) {
      await this.prisma.wishlistItem.delete({
        where: {
          userId_productId: { userId, productId },
        },
      });
      return { added: false };
    } else {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException('Sản phẩm không tồn tại!');
      }

      await this.prisma.wishlistItem.create({
        data: { userId, productId },
      });
      return { added: true };
    }
  }

  async mergeWishlist(userId: string, productIds: string[]) {
    for (const productId of productIds) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) continue;

      await this.prisma.wishlistItem.upsert({
        where: {
          userId_productId: { userId, productId },
        },
        update: {},
        create: { userId, productId },
      });
    }

    return this.getWishlist(userId);
  }
}

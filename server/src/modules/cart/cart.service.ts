import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addToCart(userId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại!');
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    const targetQty = existing ? existing.quantity + quantity : quantity;

    if (product.stock !== null && product.stock !== undefined && targetQty > product.stock) {
      throw new BadRequestException(
        `Chỉ có thể thêm tối đa ${product.stock} sản phẩm này vào giỏ hàng (Hiện tại trong giỏ: ${existing ? existing.quantity : 0})`,
      );
    }

    return this.prisma.cartItem.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      update: { quantity: targetQty },
      create: { userId, productId, quantity: targetQty },
      include: { product: true },
    });
  }

  async updateQuantity(userId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại!');
    }

    if (product.stock !== null && product.stock !== undefined && quantity > product.stock) {
      throw new BadRequestException(
        `Chỉ còn ${product.stock} sản phẩm trong kho!`,
      );
    }

    return this.prisma.cartItem.update({
      where: {
        userId_productId: { userId, productId },
      },
      data: { quantity },
      include: { product: true },
    });
  }

  async removeFromCart(userId: string, productId: string) {
    try {
      return await this.prisma.cartItem.delete({
        where: {
          userId_productId: { userId, productId },
        },
      });
    } catch (e) {
      // Ignore if already deleted
      return null;
    }
  }

  async clearCart(userId: string) {
    return this.prisma.cartItem.deleteMany({
      where: { userId },
    });
  }

  async mergeCart(
    userId: string,
    items: { productId: string; quantity: number }[],
  ) {
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) continue;

      const existing = await this.prisma.cartItem.findUnique({
        where: {
          userId_productId: { userId, productId: item.productId },
        },
      });

      let targetQty = existing ? existing.quantity + item.quantity : item.quantity;
      if (product.stock !== null && product.stock !== undefined && targetQty > product.stock) {
        targetQty = product.stock;
      }

      await this.prisma.cartItem.upsert({
        where: {
          userId_productId: { userId, productId: item.productId },
        },
        update: { quantity: targetQty },
        create: { userId, productId: item.productId, quantity: targetQty },
      });
    }

    return this.getCart(userId);
  }
}

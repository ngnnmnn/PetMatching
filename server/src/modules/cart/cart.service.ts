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
      include: { product: true, variant: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async addToCart(
    userId: string,
    productId: string,
    quantity: number,
    variantId?: string | null,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại!');
    }

    let variant = null;
    if (variantId) {
      variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      if (!variant) {
        throw new NotFoundException('Biến thể sản phẩm không tồn tại!');
      }
    }

    const existing = await this.prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        variantId: variantId || null,
      },
    });

    const targetQty = existing ? existing.quantity + quantity : quantity;
    const stock = variant ? variant.stock : product.stock;

    if (stock !== null && stock !== undefined && targetQty > stock) {
      throw new BadRequestException(
        `Chỉ có thể thêm tối đa ${stock} sản phẩm này vào giỏ hàng (Hiện tại trong giỏ: ${existing ? existing.quantity : 0})`,
      );
    }

    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: targetQty },
        include: { product: true, variant: true },
      });
    } else {
      return this.prisma.cartItem.create({
        data: {
          userId,
          productId,
          variantId: variantId || null,
          quantity: targetQty,
        },
        include: { product: true, variant: true },
      });
    }
  }

  async updateQuantity(
    userId: string,
    productId: string,
    quantity: number,
    variantId?: string | null,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại!');
    }

    let variant = null;
    if (variantId) {
      variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      if (!variant) {
        throw new NotFoundException('Biến thể sản phẩm không tồn tại!');
      }
    }

    const stock = variant ? variant.stock : product.stock;

    if (stock !== null && stock !== undefined && quantity > stock) {
      throw new BadRequestException(`Chỉ còn ${stock} sản phẩm trong kho!`);
    }

    const existing = await this.prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        variantId: variantId || null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Sản phẩm không có trong giỏ hàng!');
    }

    return this.prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity },
      include: { product: true, variant: true },
    });
  }

  async removeFromCart(
    userId: string,
    productId: string,
    variantId?: string | null,
  ) {
    try {
      const existing = await this.prisma.cartItem.findFirst({
        where: {
          userId,
          productId,
          variantId: variantId || null,
        },
      });

      if (existing) {
        return await this.prisma.cartItem.delete({
          where: { id: existing.id },
        });
      }
      return null;
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
    items: { productId: string; quantity: number; variantId?: string | null }[],
  ) {
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) continue;

      const variantId = item.variantId || null;
      let variant = null;
      if (variantId) {
        variant = await this.prisma.productVariant.findUnique({
          where: { id: variantId },
        });
        if (!variant) continue;
      }

      const existing = await this.prisma.cartItem.findFirst({
        where: {
          userId,
          productId: item.productId,
          variantId,
        },
      });

      let targetQty = existing
        ? existing.quantity + item.quantity
        : item.quantity;
      const stock = variant ? variant.stock : product.stock;
      if (stock !== null && stock !== undefined && targetQty > stock) {
        targetQty = stock;
      }

      if (existing) {
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: targetQty },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            userId,
            productId: item.productId,
            variantId,
            quantity: targetQty,
          },
        });
      }
    }

    return this.getCart(userId);
  }
}

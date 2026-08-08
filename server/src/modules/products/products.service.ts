import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetProductsDto } from './dto/get-products.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private async attachSoldCount<T extends { id: string }>(products: T[]) {
    if (!products.length) return [];
    const productIds = products.map((p) => p.id);
    const sales = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        order: {
          status: { in: ['DELIVERED', 'SHIPPED', 'PROCESSING', 'PACKED'] },
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const salesMap = new Map<string, number>();
    sales.forEach((s) => {
      salesMap.set(s.productId, s._sum.quantity || 0);
    });

    return products.map((p) => ({
      ...p,
      soldCount: salesMap.get(p.id) || 0,
    }));
  }

  async getProducts(dto: GetProductsDto) {
    const {
      category,
      targetSpecies,
      search,
      sortBy = 'popular',
      page = 1,
      limit = 12,
    } = dto;

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (targetSpecies && targetSpecies !== 'ALL') {
      where.OR = [{ targetSpecies }, { targetSpecies: 'ALL' }];
    }

    if (search?.trim()) {
      const keyword = search.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { brand: { contains: keyword, mode: 'insensitive' } },
            { description: { contains: keyword, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const skip = (page - 1) * limit;

    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      const [allProducts, total] = await this.prisma.$transaction([
        this.prisma.product.findMany({ where, include: { variants: true } }),
        this.prisma.product.count({ where }),
      ]);

      const sorted = allProducts
        .sort((a, b) => {
          const priceA = a.salePrice ?? (a.sellingPrice || 0);
          const priceB = b.salePrice ?? (b.sellingPrice || 0);
          const priceCompare =
            sortBy === 'price_asc' ? priceA - priceB : priceB - priceA;

          return priceCompare || b.reviewCount - a.reviewCount;
        })
        .slice(skip, skip + limit);

      const data = await this.attachSoldCount(sorted);

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      sortBy === 'newest'
        ? [{ createdAt: 'desc' }, { id: 'desc' }]
        : [{ reviewCount: 'desc' }, { rating: 'desc' }];

    const [rawProducts, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { variants: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    const data = await this.attachSoldCount(rawProducts);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFeaturedProducts() {
    const products = await this.prisma.product.findMany({
      where: {
        isFeatured: true,
        isActive: true,
        stock: { gt: 0 },
      },
      include: {
        variants: true,
      },
    });

    const productsWithSales = await this.attachSoldCount(products);
    return productsWithSales.sort((a, b) => b.soldCount - a.soldCount).slice(0, 8);
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!product) return null;
    const [withSales] = await this.attachSoldCount([product]);
    return withSales;
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getReviews(productId: string) {
    return this.prisma.productReview.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async canReview(userId: string, productId: string) {
    // 1. Check if user already reviewed this product
    const existingReview = await this.prisma.productReview.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });
    if (existingReview) {
      return false;
    }

    // 2. Check if user has an order containing this product that is DELIVERED
    const deliveredOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: 'DELIVERED',
        items: {
          some: {
            productId,
          },
        },
      },
    });

    return !!deliveredOrder;
  }

  async createReview(
    userId: string,
    productId: string,
    dto: { rating: number; comment?: string; images?: string[] },
  ) {
    const { rating, comment, images = [] } = dto;
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Số sao đánh giá phải từ 1 đến 5.');
    }

    const eligible = await this.canReview(userId, productId);
    if (!eligible) {
      throw new BadRequestException(
        'Bạn chỉ có thể đánh giá sản phẩm sau khi đã nhận được hàng và chưa đánh giá sản phẩm này.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the review
      const review = await tx.productReview.create({
        data: {
          rating,
          comment,
          images: Array.isArray(images) ? images : [],
          userId,
          productId,
        },
      });

      // 2. Calculate new average rating and review count
      const aggregate = await tx.productReview.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { id: true },
      });

      const averageRating = aggregate._avg.rating ?? 0;
      const reviewCount = aggregate._count.id ?? 0;

      // 3. Update the Product model
      await tx.product.update({
        where: { id: productId },
        data: {
          rating: averageRating,
          reviewCount: reviewCount,
        },
      });

      return review;
    });
  }

  async updateReview(
    userId: string,
    reviewId: string,
    dto: { rating: number; comment?: string; images?: string[] },
  ) {
    const { rating, comment, images } = dto;
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Số sao đánh giá phải từ 1 đến 5.');
    }

    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá.');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đánh giá này.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.productReview.update({
        where: { id: reviewId },
        data: {
          rating,
          comment,
          ...(images !== undefined && { images: Array.isArray(images) ? images : [] }),
        },
      });

      const aggregate = await tx.productReview.aggregate({
        where: { productId: review.productId },
        _avg: { rating: true },
        _count: { id: true },
      });

      const averageRating = aggregate._avg.rating ?? 0;
      const reviewCount = aggregate._count.id ?? 0;

      await tx.product.update({
        where: { id: review.productId },
        data: {
          rating: averageRating,
          reviewCount: reviewCount,
        },
      });

      return updatedReview;
    });
  }

  async deleteReview(userId: string, reviewId: string) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isOwner = review.userId === userId;
    const isAdminOrMod =
      user?.role === 'ADMIN' ||
      user?.role === 'MODERATOR' ||
      user?.role === 'STORE_MANAGER';

    if (!isOwner && !isAdminOrMod) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá này.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.productReview.delete({
        where: { id: reviewId },
      });

      const aggregate = await tx.productReview.aggregate({
        where: { productId: review.productId },
        _avg: { rating: true },
        _count: { id: true },
      });

      const averageRating = aggregate._avg.rating ?? 0;
      const reviewCount = aggregate._count.id ?? 0;

      await tx.product.update({
        where: { id: review.productId },
        data: {
          rating: averageRating,
          reviewCount: reviewCount,
        },
      });

      return { success: true, message: 'Đã xóa đánh giá thành công.' };
    });
  }
}

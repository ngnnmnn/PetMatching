import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetProductsDto } from './dto/get-products.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

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
        this.prisma.product.findMany({ where }),
        this.prisma.product.count({ where }),
      ]);

      const data = allProducts
        .sort((a, b) => {
          const priceA = a.salePrice ?? a.originalPrice;
          const priceB = b.salePrice ?? b.originalPrice;
          const priceCompare = sortBy === 'price_asc' ? priceA - priceB : priceB - priceA;

          return priceCompare || b.reviewCount - a.reviewCount;
        })
        .slice(skip, skip + limit);

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      sortBy === 'newest'
        ? [{ createdAt: 'desc' }, { id: 'desc' }]
        : [{ reviewCount: 'desc' }, { rating: 'desc' }];

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFeaturedProducts() {
    return this.prisma.product.findMany({
      where: { isFeatured: true, isActive: true },
      orderBy: { reviewCount: 'desc' },
      take: 4,
    });
  }

  async getProductById(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
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

  async createReview(userId: string, productId: string, dto: { rating: number; comment?: string }) {
    const { rating, comment } = dto;
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Số sao đánh giá phải từ 1 đến 5.');
    }

    const eligible = await this.canReview(userId, productId);
    if (!eligible) {
      throw new BadRequestException('Bạn chỉ có thể đánh giá sản phẩm sau khi đã nhận được hàng và chưa đánh giá sản phẩm này.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the review
      const review = await tx.productReview.create({
        data: {
          rating,
          comment,
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
}

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

  /**
   * Tính tổng số lượng sản phẩm đã bán thực tế từ các đơn hàng thành công (DELIVERED, SHIPPED, PROCESSING, PACKED)
   * và tính toán tổng tồn kho thực tế từ danh sách biến thể đính kèm vào mỗi sản phẩm.
   */
  private async attachSoldCount<T extends { id: string; stock?: number | null; variants?: any[] }>(products: T[]) {
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

    return products.map((p) => {
      const calculatedStock =
        p.variants && p.variants.length > 0
          ? p.variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0)
          : p.stock;
      return {
        ...p,
        stock: calculatedStock,
        soldCount: salesMap.get(p.id) || 0,
      };
    });
  }

  private applyCategoryDiversity<T extends { category?: string | null }>(
    items: T[],
    pageSize = 12,
    maxPerCategoryPerPage = 3,
  ): T[] {
    if (!items.length) return [];

    const totalPages = Math.ceil(items.length / pageSize);
    const result: T[] = [];
    const remaining = [...items];

    for (let page = 0; page < totalPages; page++) {
      const pageCategoryCount: Record<string, number> = {};
      let pageItemsCount = 0;
      const nextRemaining: T[] = [];

      for (const item of remaining) {
        const cat = item.category || 'UNKNOWN';
        const count = pageCategoryCount[cat] || 0;

        if (pageItemsCount < pageSize && count < maxPerCategoryPerPage) {
          result.push(item);
          pageCategoryCount[cat] = count + 1;
          pageItemsCount++;
        } else {
          nextRemaining.push(item);
        }
      }

      // If page isn't full yet (e.g., some categories ran out), fill remaining slots for this page
      while (pageItemsCount < pageSize && nextRemaining.length > 0) {
        const item = nextRemaining.shift()!;
        result.push(item);
        pageItemsCount++;
      }

      remaining.length = 0;
      remaining.push(...nextRemaining);
    }

    return result;
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

      const getEffectivePrice = (p: any) => {
        if (p.variants && p.variants.length > 0) {
          const activeVars = p.variants.filter((v: any) => v.isActive !== false);
          const vars = activeVars.length > 0 ? activeVars : p.variants;
          const prices = vars.map((v: any) => v.salePrice ?? v.sellingPrice).filter((pr: number) => pr > 0);
          if (prices.length > 0) {
            return Math.min(...prices);
          }
        }
        return p.salePrice ?? (p.sellingPrice || 0);
      };

      const sorted = allProducts
        .sort((a, b) => {
          const priceA = getEffectivePrice(a);
          const priceB = getEffectivePrice(b);
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

    if (sortBy === 'popular') {
      const [allProducts, total] = await this.prisma.$transaction([
        this.prisma.product.findMany({ where, include: { variants: true } }),
        this.prisma.product.count({ where }),
      ]);

      const productsWithSales = await this.attachSoldCount(allProducts);

      // Multi-tier ranking: soldCount -> rating -> reviewCount -> isFeatured -> createdAt
      const sorted = productsWithSales.sort((a, b) => {
        if (b.soldCount !== a.soldCount) return b.soldCount - a.soldCount;
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
        if ((b.isFeatured ? 1 : 0) !== (a.isFeatured ? 1 : 0)) return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Apply category diversity cap (max 3 items per category on page 1) when browsing all categories
      let finalOrderedProducts = sorted;
      if (!category) {
        finalOrderedProducts = this.applyCategoryDiversity(sorted, limit, 3);
      }

      const pagedData = finalOrderedProducts.slice(skip, skip + limit);

      return {
        data: pagedData,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];

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

  async getUnreviewedOrder(userId: string, productId: string) {
    // Find all DELIVERED orders for this user containing this product
    const deliveredOrders = await this.prisma.order.findMany({
      where: {
        userId,
        status: 'DELIVERED',
        items: {
          some: { productId },
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (deliveredOrders.length === 0) {
      return null;
    }

    // Find reviews user has written for this product
    const existingReviews = await this.prisma.productReview.findMany({
      where: {
        userId,
        productId,
      },
      select: { orderId: true },
    });

    const reviewedOrderIds = new Set(
      existingReviews.map((r) => r.orderId).filter(Boolean),
    );

    // Return the first delivered order that hasn't been reviewed yet
    const unreviewed = deliveredOrders.find((o) => !reviewedOrderIds.has(o.id));
    return unreviewed || null;
  }

  async canReview(userId: string, productId: string) {
    const order = await this.getUnreviewedOrder(userId, productId);
    return !!order;
  }

  async createReview(
    userId: string,
    productId: string,
    dto: { rating: number; comment?: string; images?: string[]; orderId?: string },
  ) {
    const { rating, comment, images = [] } = dto;
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Số sao đánh giá phải từ 1 đến 5.');
    }

    let targetOrderId = dto.orderId;
    if (!targetOrderId) {
      const unreviewedOrder = await this.getUnreviewedOrder(userId, productId);
      if (!unreviewedOrder) {
        throw new BadRequestException(
          'Bạn chỉ có thể đánh giá sản phẩm sau khi đã nhận được hàng và mỗi đơn hàng thành công chỉ được đánh giá 1 lần.',
        );
      }
      targetOrderId = unreviewedOrder.id;
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the review with orderId
      const review = await tx.productReview.create({
        data: {
          rating,
          comment,
          images: Array.isArray(images) ? images : [],
          userId,
          productId,
          orderId: targetOrderId,
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

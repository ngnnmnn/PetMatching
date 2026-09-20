import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MemoryCacheService } from '../../common/cache/memory-cache.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetProductsDto } from './dto/get-products.dto';

const PRODUCT_CACHE_PREFIX = 'products:';
const PRODUCT_LIST_TTL_MS = 30_000;
const PRODUCT_DETAIL_TTL_MS = 60_000;
const PRODUCT_CATEGORY_TTL_MS = 10 * 60_000;

/**
 * Loại bỏ dấu tiếng Việt để phục vụ tìm kiếm không phân biệt có dấu và không dấu
 */
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MemoryCacheService = new MemoryCacheService(),
  ) {}

  /** Tạo khóa cache ổn định theo đúng các tham số ảnh hưởng đến danh sách sản phẩm. */
  private getProductListCacheKey(dto: GetProductsDto): string {
    return `${PRODUCT_CACHE_PREFIX}list:${JSON.stringify({
      category: dto.category || '',
      targetSpecies: dto.targetSpecies || '',
      search: dto.search?.trim().toLowerCase() || '',
      sortBy: dto.sortBy || 'popular',
      page: dto.page || 1,
      limit: dto.limit || 12,
    })}`;
  }

  /** Xóa dữ liệu công khai đã cache sau khi đánh giá làm thay đổi sản phẩm. */
  private invalidateProductCache(): void {
    this.cache.deleteByPrefix(PRODUCT_CACHE_PREFIX);
  }

  /**
   * Tính tổng số lượng sản phẩm đã bán thực tế từ các đơn hàng thành công (DELIVERED, SHIPPED, PROCESSING, PACKED)
   * và tính toán tổng tồn kho thực tế từ danh sách biến thể đính kèm vào mỗi sản phẩm.
   */
  private async attachSoldCount<
    T extends { id: string; stock?: number | null; variants?: any[] },
  >(products: T[]) {
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

  /** Kiểm tra khả năng mở bán và tồn kho thực tế của sản phẩm */
  private getProductAvailability(product: any): number {
    if (product.isActive === false) return 0;
    if (product.variants && product.variants.length > 0) {
      const activeVars = product.variants.filter(
        (v: any) => v.isActive !== false,
      );
      if (activeVars.length === 0) return 0;
      const totalStock = activeVars.reduce(
        (sum: number, v: any) => sum + Number(v.stock || 0),
        0,
      );
      return totalStock > 0 ? 1 : 0;
    }
    return Number(product.stock || 0) > 0 ? 1 : 0;
  }

  /**
   * Lấy danh sách sản phẩm phân trang theo các tiêu chí lọc (Danh mục, Loài thú cưng, Từ khóa có/không dấu)
   * và thuật toán xếp hạng đa tầng (Nổi bật -> Bán chạy -> Rating -> Còn lại).
   */
  async getProducts(dto: GetProductsDto) {
    return this.cache.getOrSet(
      this.getProductListCacheKey(dto),
      PRODUCT_LIST_TTL_MS,
      () => this.loadProducts(dto),
    );
  }

  /** Truy vấn, lọc và sắp xếp danh sách khi cache chưa có dữ liệu. */
  private async loadProducts(dto: GetProductsDto) {
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

    // Tải toàn bộ sản phẩm thỏa mãn điều kiện trạng thái, danh mục, loài
    const allDbProducts = await this.prisma.product.findMany({
      where,
      omit: { storeId: true, importPrice: true },
      include: {
        variants: { omit: { importPrice: true } },
      },
    });

    // Lọc theo từ khóa tìm kiếm (hỗ trợ có dấu hoặc không dấu tiếng Việt)
    let filteredProducts = allDbProducts;
    if (search?.trim()) {
      const normKeyword = removeVietnameseTones(search);
      filteredProducts = filteredProducts.filter((p) => {
        const normName = removeVietnameseTones(p.name || '');
        const normBrand = removeVietnameseTones(p.brand || '');
        const normDesc = removeVietnameseTones(p.description || '');
        return (
          normName.includes(normKeyword) ||
          normBrand.includes(normKeyword) ||
          normDesc.includes(normKeyword)
        );
      });
    }

    const total = filteredProducts.length;
    const skip = (page - 1) * limit;

    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      const getEffectivePrice = (p: any) => {
        if (p.variants && p.variants.length > 0) {
          const activeVars = p.variants.filter(
            (v: any) => v.isActive !== false,
          );
          const vars = activeVars.length > 0 ? activeVars : p.variants;
          const prices = vars
            .map((v: any) => v.salePrice ?? v.sellingPrice)
            .filter((pr: number) => pr > 0);
          if (prices.length > 0) {
            return Math.min(...prices);
          }
        }
        return p.salePrice ?? (p.sellingPrice || 0);
      };

      const sorted = filteredProducts
        .sort((a, b) => {
          const availA = this.getProductAvailability(a);
          const availB = this.getProductAvailability(b);
          if (availB !== availA) return availB - availA; // Còn hàng lên trên, hết hàng xuống dưới

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

    // Sắp xếp theo đánh giá: rating cao hơn lên trước, nếu cùng sao xét số lượt đánh giá nhiều hơn lên trước
    if (sortBy === 'rating_desc') {
      const sorted = filteredProducts
        .sort((a, b) => {
          const availA = this.getProductAvailability(a);
          const availB = this.getProductAvailability(b);
          if (availB !== availA) return availB - availA; // Còn hàng lên trước, hết hàng xuống cuối

          // 1. Rating giảm dần
          const rateA = Number(a.rating || 0);
          const rateB = Number(b.rating || 0);
          if (rateB !== rateA) return rateB - rateA;

          // 2. Cùng rating xét theo số lượng người đánh giá (reviewCount) càng nhiều thì ở trên
          const revA = Number(a.reviewCount || 0);
          const revB = Number(b.reviewCount || 0);
          if (revB !== revA) return revB - revA;

          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        })
        .slice(skip, skip + limit);

      const data = await this.attachSoldCount(sorted);

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    // Sắp xếp theo giảm giá: sản phẩm giảm giá nhiều hơn thì đẩy lên trên
    if (sortBy === 'discount_desc') {
      const getProductDiscountPercent = (p: any) => {
        const getEffectivePrice = (item: any) => {
          if (item.variants && item.variants.length > 0) {
            const activeVars = item.variants.filter(
              (v: any) => v.isActive !== false,
            );
            const vars = activeVars.length > 0 ? activeVars : item.variants;
            const prices = vars
              .map((v: any) => v.salePrice ?? v.sellingPrice)
              .filter((pr: number) => pr > 0);
            if (prices.length > 0) return Math.min(...prices);
          }
          return item.salePrice ?? (item.sellingPrice || 0);
        };
        const lowest = getEffectivePrice(p);
        const original = p.sellingPrice;
        if (typeof original === 'number' && original > 0 && lowest < original) {
          return Math.round(((original - lowest) / original) * 100);
        }
        return 0;
      };

      const sorted = filteredProducts
        .sort((a, b) => {
          const availA = this.getProductAvailability(a);
          const availB = this.getProductAvailability(b);
          if (availB !== availA) return availB - availA; // Còn hàng lên trước, hết hàng xuống cuối

          // 1. Phần trăm giảm giá cao hơn lên trước
          const discA = getProductDiscountPercent(a);
          const discB = getProductDiscountPercent(b);
          if (discB !== discA) return discB - discA;

          // 2. Cùng % giảm thì xét số tiền giảm
          const diffA =
            (a.sellingPrice || 0) - (a.salePrice ?? a.sellingPrice ?? 0);
          const diffB =
            (b.sellingPrice || 0) - (b.salePrice ?? b.sellingPrice ?? 0);
          if (diffB !== diffA) return diffB - diffA;

          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        })
        .slice(skip, skip + limit);

      const data = await this.attachSoldCount(sorted);

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    if (sortBy === 'popular') {
      const productsWithSales = await this.attachSoldCount(filteredProducts);

      // Thứ tự sắp xếp đa tầng: Còn hàng -> Nổi bật -> Bán chạy -> Rating -> Còn lại
      const sorted = productsWithSales.sort((a, b) => {
        const availA = this.getProductAvailability(a);
        const availB = this.getProductAvailability(b);
        if (availB !== availA) return availB - availA; // Còn hàng lên trên, hết hàng xuống dưới

        // 1. Nổi bật (isFeatured)
        const featA = a.isFeatured ? 1 : 0;
        const featB = b.isFeatured ? 1 : 0;
        if (featB !== featA) return featB - featA;

        // 2. Bán chạy (soldCount)
        if (b.soldCount !== a.soldCount) return b.soldCount - a.soldCount;

        // 3. Đánh giá (Rating & reviewCount)
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (b.reviewCount !== a.reviewCount)
          return b.reviewCount - a.reviewCount;

        // 4. Các sản phẩm còn lại theo ngày tạo
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      // Áp dụng giới hạn đa dạng danh mục (tối đa 3 sản phẩm/danh mục ở trang 1) khi xem tất cả
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

    const sorted = filteredProducts
      .sort((a, b) => {
        const availA = this.getProductAvailability(a);
        const availB = this.getProductAvailability(b);
        if (availB !== availA) return availB - availA; // Còn hàng lên trên, hết hàng xuống dưới

        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
      .slice(skip, skip + limit);

    const data = await this.attachSoldCount(sorted);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Lấy sản phẩm nổi bật từ cache ngắn hạn để tránh lặp truy vấn bán hàng nặng. */
  async getFeaturedProducts() {
    return this.cache.getOrSet(
      `${PRODUCT_CACHE_PREFIX}featured`,
      PRODUCT_DETAIL_TTL_MS,
      async () => {
        const products = await this.prisma.product.findMany({
          where: {
            isFeatured: true,
            isActive: true,
            stock: { gt: 0 },
          },
          omit: { storeId: true, importPrice: true },
          include: {
            variants: { omit: { importPrice: true } },
          },
        });

        const productsWithSales = await this.attachSoldCount(products);
        return productsWithSales
          .sort((a, b) => b.soldCount - a.soldCount)
          .slice(0, 8);
      },
    );
  }

  /** Lấy chi tiết sản phẩm và số đã bán từ cache theo mã sản phẩm. */
  async getProductById(id: string) {
    return this.cache.getOrSet(
      `${PRODUCT_CACHE_PREFIX}detail:${id}`,
      PRODUCT_DETAIL_TTL_MS,
      async () => {
        const product = await this.prisma.product.findUnique({
          where: { id },
          omit: { storeId: true, importPrice: true },
          include: {
            variants: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              omit: { importPrice: true },
            },
          },
        });

        if (!product) return null;
        const [withSales] = await this.attachSoldCount([product]);
        return withSales;
      },
    );
  }

  /** Lấy danh mục sản phẩm từ cache dài hơn vì dữ liệu ít thay đổi. */
  async getCategories() {
    return this.cache.getOrSet(
      `${PRODUCT_CACHE_PREFIX}categories`,
      PRODUCT_CATEGORY_TTL_MS,
      () =>
        this.prisma.category.findMany({
          orderBy: { name: 'asc' },
        }),
    );
  }

  /** Lấy đánh giá sản phẩm từ cache ngắn hạn theo mã sản phẩm. */
  async getReviews(productId: string) {
    return this.cache.getOrSet(
      `${PRODUCT_CACHE_PREFIX}reviews:${productId}`,
      PRODUCT_LIST_TTL_MS,
      () =>
        this.prisma.productReview.findMany({
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
        }),
    );
  }

  /** Tìm đơn đã giao chưa được đánh giá bằng hai truy vấn chạy song song. */
  async getUnreviewedOrder(userId: string, productId: string) {
    const [deliveredOrders, existingReviews] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          userId,
          status: 'DELIVERED',
          items: {
            some: { productId },
          },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.productReview.findMany({
        where: {
          userId,
          productId,
        },
        select: { orderId: true },
      }),
    ]);

    if (deliveredOrders.length === 0) {
      return null;
    }

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
    dto: {
      rating: number;
      comment?: string;
      images?: string[];
      orderId?: string;
    },
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

    const createdReview = await this.prisma.$transaction(async (tx) => {
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
    this.invalidateProductCache();
    return createdReview;
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
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa đánh giá này.',
      );
    }

    const updatedReviewResult = await this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.productReview.update({
        where: { id: reviewId },
        data: {
          rating,
          comment,
          ...(images !== undefined && {
            images: Array.isArray(images) ? images : [],
          }),
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
    this.invalidateProductCache();
    return updatedReviewResult;
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

    const deleteResult = await this.prisma.$transaction(async (tx) => {
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
    this.invalidateProductCache();
    return deleteResult;
  }
}

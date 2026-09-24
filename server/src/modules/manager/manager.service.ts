import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import {
  appendJsonSheet,
  createWorkbook,
  writeWorkbook,
} from '../../common/excel.utils';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MemoryCacheService } from '../../common/cache/memory-cache.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import {
  fulfilledStoreOrderWhere,
  recognizedStoreRevenueWhere,
} from '../../common/revenue.utils';
import {
  findConfiguredStoreId,
  lowStockProductWhere,
} from '../../common/store.utils';
import {
  calculateRevenueGrowth,
  resolveDashboardRange,
  serializeDashboardRange,
} from '../admin/shared/dashboard-range.utils';
import {
  NotificationCategory,
  NotificationEventType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ORDER_STATUS_LABELS } from '../notifications/notification-status-labels';
import type {
  CreateManagerProductInput,
  ManagerProductVariantInput,
  UpdateManagerProductInput,
} from './dto/manager-product-input';

@Injectable()
export class ManagerService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private readonly notifications: NotificationsService,
    private readonly cache: MemoryCacheService = new MemoryCacheService(),
  ) {}

  /** Xóa cache sản phẩm công khai sau mọi thao tác quản lý làm đổi dữ liệu nguồn. */
  private invalidatePublicProductCache(): void {
    this.cache.deleteByPrefix('products:');
  }

  private async getConfiguredStoreId() {
    const storeId = await findConfiguredStoreId(this.prisma);
    if (!storeId) {
      throw new BadRequestException('Cửa hàng chưa được cấu hình.');
    }
    return storeId;
  }

  async getActivitySnapshot() {
    const storeId = await this.getConfiguredStoreId();
    const [
      recentOrders,
      orderState,
      paymentState,
      productState,
      variantState,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          storeId,
          NOT: {
            payment: { is: { method: 'QR', status: 'PENDING' } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true },
      }),
      this.prisma.order.aggregate({
        where: { storeId },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.prisma.payment.aggregate({
        where: { order: { storeId } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.prisma.product.aggregate({
        where: { storeId },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.prisma.productVariant.aggregate({
        where: { product: { storeId } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
    ]);

    return {
      orderIds: recentOrders.map(({ id }) => id),
      ordersVersion: `${orderState._count._all}:${orderState._max.updatedAt?.getTime() ?? 0}:${paymentState._count._all}:${paymentState._max.updatedAt?.getTime() ?? 0}`,
      inventoryVersion: `${productState._count._all}:${productState._max.updatedAt?.getTime() ?? 0}:${variantState._count._all}:${variantState._max.updatedAt?.getTime() ?? 0}`,
    };
  }

  /**
   * Đồng bộ dữ liệu tồn kho, giá bán và trạng thái kinh doanh của sản phẩm theo các phân loại (variants).
   * Nếu tất cả phân loại đều bị ngưng bán (isActive = false), tự động cập nhật sản phẩm thành ngưng bán (isActive = false).
   */
  private async syncProductWithVariants(
    productId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = transaction ?? this.prisma;
    const variants = await client.productVariant.findMany({
      where: { productId },
    });

    if (variants.length === 0) return;

    const totalStock = variants.reduce(
      (sum, variant) => sum + variant.stock,
      0,
    );

    let minVariant = variants[0];
    let minEffectivePrice =
      minVariant.salePrice !== null &&
      minVariant.salePrice < minVariant.sellingPrice
        ? minVariant.salePrice
        : minVariant.sellingPrice;

    for (let i = 1; i < variants.length; i++) {
      const variant = variants[i];
      const effectivePrice =
        variant.salePrice !== null && variant.salePrice < variant.sellingPrice
          ? variant.salePrice
          : variant.sellingPrice;
      if (effectivePrice < minEffectivePrice) {
        minEffectivePrice = effectivePrice;
        minVariant = variant;
      }
    }

    // Kiểm tra xem có bất kỳ phân loại nào đang mở bán hay không
    const hasActiveVariant = variants.some((v) => v.isActive !== false);

    await client.product.update({
      where: { id: productId },
      data: {
        stock: totalStock,
        sellingPrice: minVariant.sellingPrice,
        salePrice: minVariant.salePrice,
        ...(minVariant.importPrice !== null
          ? { importPrice: minVariant.importPrice }
          : {}),
        // Nếu tất cả phân loại đều ngừng bán, sản phẩm cha cũng tự động chuyển sang ngừng bán
        ...(!hasActiveVariant ? { isActive: false } : {}),
      },
    });
  }

  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') +
      '-' +
      Math.floor(Math.random() * 1000)
    );
  }

  private async generateProductId(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const id = String(Math.floor(100000 + Math.random() * 900000));
      const exists = await this.prisma.product.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!exists) return id;
    }

    throw new BadRequestException(
      'Không thể tạo mã sản phẩm. Vui lòng thử lại.',
    );
  }

  async getDashboardStats(
    query: { range?: string; from?: string; to?: string } = {},
  ) {
    const storeId = await this.getConfiguredStoreId();
    const period = resolveDashboardRange(query);
    const storeOrderWhere: Prisma.OrderWhereInput = { storeId };
    const fulfilledOrderWhere = fulfilledStoreOrderWhere(storeId);

    const [
      periodRevenueOrders,
      allTimeRevenueSum,
      ordersByStatus,
      itemsSold,
      allTimeItemsSold,
      lowStockProducts,
      topProductSales,
      recentOrders,
      categories,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          ...recognizedStoreRevenueWhere(storeId),
          createdAt: { gte: period.previousFrom, lt: period.toExclusive },
        },
        select: { createdAt: true, totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: recognizedStoreRevenueWhere(storeId),
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: storeOrderWhere,
        _count: { _all: true },
      }),
      this.prisma.orderItem.aggregate({
        where: {
          order: {
            ...fulfilledOrderWhere,
            createdAt: { gte: period.from, lt: period.toExclusive },
          },
        },
        _sum: { quantity: true },
      }),
      this.prisma.orderItem.aggregate({
        where: { order: fulfilledOrderWhere },
        _sum: { quantity: true },
      }),
      this.prisma.product.findMany({
        where: lowStockProductWhere(storeId),
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          category: true,
          imageUrl: true,
          stock: true,
          variants: {
            select: { id: true, name: true, stock: true },
          },
        },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            ...fulfilledOrderWhere,
            createdAt: { gte: period.from, lt: period.toExclusive },
          },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.prisma.order.findMany({
        where: {
          storeId,
          NOT: {
            payment: { is: { method: 'QR', status: 'PENDING' } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          totalAmount: true,
          createdAt: true,
          customerNameSnapshot: true,
          user: { select: { name: true } },
          items: {
            select: {
              quantity: true,
              product: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.category.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const orderCounts = Object.fromEntries(
      ordersByStatus.map(({ status, _count }) => [status, _count._all]),
    );
    const countOrders = (...statuses: string[]) =>
      statuses.reduce((total, status) => total + (orderCounts[status] ?? 0), 0);
    const totalOrders = Object.values(orderCounts).reduce(
      (total, count) => total + count,
      0,
    );
    const currentRevenueOrders = periodRevenueOrders.filter(
      (order) => order.createdAt >= period.from,
    );
    const previousRevenueOrders = periodRevenueOrders.filter(
      (order) => order.createdAt < period.from,
    );
    const sumRevenue = (orders: typeof periodRevenueOrders) =>
      orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalRevenue = sumRevenue(currentRevenueOrders);
    const previousRevenue = sumRevenue(previousRevenueOrders);
    const revenueChangePercent = calculateRevenueGrowth(
      totalRevenue,
      previousRevenue,
    );
    const totalProductsSold = itemsSold._sum.quantity ?? 0;
    const allTimeProductsSold = allTimeItemsSold._sum.quantity ?? 0;

    const statusDistribution = {
      PENDING: countOrders('PENDING'),
      CONFIRMED: countOrders('CONFIRMED', 'PROCESSING', 'PACKED'),
      SHIPPED: countOrders('SHIPPED'),
      DELIVERED: countOrders('DELIVERED'),
      CANCELLED: countOrders('CANCELLED', 'EXPIRED', 'PAYMENT_ERROR'),
    };

    const topProductIds = topProductSales.map(({ productId }) => productId);
    const topProducts = topProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: topProductIds }, storeId },
          select: { id: true, name: true, category: true },
        })
      : [];
    const topProductMap = new Map(
      topProducts.map((product) => [product.id, product]),
    );
    const topSellingProducts = topProductSales.flatMap((sale) => {
      const product = topProductMap.get(sale.productId);
      return product ? [{ ...product, sales: sale._sum.quantity ?? 0 }] : [];
    });

    return {
      totalRevenue,
      allTimeRevenue: allTimeRevenueSum._sum.totalAmount ?? 0,
      previousRevenue,
      revenueChangePercent,
      range: serializeDashboardRange(period),
      totalOrders,
      totalProductsSold,
      allTimeProductsSold,
      statusDistribution,
      pendingOrders: countOrders('PENDING'),
      lowStockProducts,
      topSellingProducts,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        userName:
          order.user?.name || order.customerNameSnapshot || 'Khách vãng lai',
        items: order.items,
      })),
      categories,
    };
  }

  /**
   * Lấy danh sách sản phẩm kèm thống kê số lượng đã bán của từng phân loại và sản phẩm, số lượng đánh giá
   */
  async getProducts() {
    const storeId = await this.getConfiguredStoreId();
    const products = await this.prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      include: {
        variants: true,
        _count: { select: { reviews: true } },
      },
    });

    const salesRows = products.length
      ? await this.prisma.orderItem.groupBy({
          by: ['productId', 'variantId'],
          where: {
            productId: { in: products.map(({ id }) => id) },
            order: fulfilledStoreOrderWhere(storeId),
          },
          _sum: { quantity: true },
        })
      : [];
    const productSales = new Map<string, number>();
    const variantSales = new Map<string, number>();
    for (const { productId, variantId, _sum } of salesRows) {
      const quantity = _sum.quantity ?? 0;
      productSales.set(
        productId,
        (productSales.get(productId) ?? 0) + quantity,
      );
      if (variantId) variantSales.set(variantId, quantity);
    }

    return products.map(({ _count, ...product }) => ({
      ...product,
      isActive:
        product.variants.length > 0 &&
        product.variants.every(({ isActive }) => isActive === false)
          ? false
          : product.isActive,
      variants: product.variants.map((variant) => ({
        ...variant,
        sales: variantSales.get(variant.id) ?? 0,
      })),
      sales: productSales.get(product.id) ?? 0,
      reviewCount: _count.reviews,
    }));
  }

  /**
   * Tạo sản phẩm mới và chuẩn hóa dữ liệu các phân loại trước khi lưu.
   */
  async createProduct(dto: CreateManagerProductInput) {
    const slug = this.generateSlug(dto.name);
    const id = await this.generateProductId();
    const storeId = await this.getConfiguredStoreId();

    // Bắt buộc sản phẩm phải có ít nhất 1 phân loại
    if (
      !dto.variants ||
      !Array.isArray(dto.variants) ||
      dto.variants.length === 0
    ) {
      throw new BadRequestException('Sản phẩm phải có ít nhất 1 phân loại.');
    }

    // Chuẩn hóa và xác thực dữ liệu từng phân loại
    const productWeightKg =
      dto.weightKg !== undefined && dto.weightKg !== null && dto.weightKg !== ''
        ? Number(dto.weightKg)
        : 0.5;

    const processedVariants = dto.variants.map((v: any) => {
      if (!v.name || !v.name.trim()) {
        throw new BadRequestException('Tên phân loại không được để trống.');
      }
      const vImportPrice =
        v.importPrice !== undefined &&
        v.importPrice !== null &&
        v.importPrice !== ''
          ? Number(v.importPrice)
          : null;
      if (vImportPrice === null || isNaN(vImportPrice) || vImportPrice <= 0) {
        throw new BadRequestException(
          `Giá nhập của phân loại "${v.name}" phải là số lớn hơn 0.`,
        );
      }
      // Nếu không nhập giá bán thì tự động gán giá bán = giá nhập
      let vSellingPrice =
        v.sellingPrice !== undefined &&
        v.sellingPrice !== null &&
        v.sellingPrice !== ''
          ? Number(v.sellingPrice)
          : vImportPrice;
      if (isNaN(vSellingPrice) || vSellingPrice <= 0) {
        vSellingPrice = vImportPrice;
      }
      const vSalePrice =
        v.salePrice !== undefined && v.salePrice !== null && v.salePrice !== ''
          ? Number(v.salePrice)
          : null;
      const vStock =
        v.stock !== undefined && v.stock !== null && v.stock !== ''
          ? Number(v.stock)
          : 0;
      const vWeightKg =
        v.weightKg !== undefined && v.weightKg !== null && v.weightKg !== ''
          ? Number(v.weightKg)
          : productWeightKg;

      return {
        name: v.name.trim(),
        importPrice: vImportPrice,
        sellingPrice: vSellingPrice,
        salePrice: vSalePrice,
        stock: vStock,
        weightKg: vWeightKg,
        imageUrl: v.imageUrl || null,
        isActive: v.isActive !== undefined ? v.isActive : true,
      };
    });

    // Tổng hợp tồn kho và khoảng giá từ các phân loại con
    const finalStock = processedVariants.reduce(
      (sum: number, v: any) => sum + v.stock,
      0,
    );
    const sellingPrice = Math.min(
      ...processedVariants.map((v: any) => v.sellingPrice),
    );
    const importPrices = processedVariants
      .map((v: any) => v.importPrice)
      .filter((ip: any): ip is number => ip !== null);
    const importPrice =
      importPrices.length > 0 ? Math.min(...importPrices) : null;
    const salePrices = processedVariants
      .map((v: any) => v.salePrice)
      .filter((sp: any): sp is number => sp !== null);
    const salePrice = salePrices.length > 0 ? Math.min(...salePrices) : null;

    const created = await this.prisma.product.create({
      data: {
        id,
        storeId,
        name: dto.name,
        slug,
        category: dto.category,
        targetSpecies: dto.targetSpecies || 'ALL',
        description: dto.description || '',
        imageUrl: dto.imageUrl || processedVariants[0]?.imageUrl || '',
        images: dto.images || [],
        specifications: dto.specifications || {},
        sellingPrice,
        importPrice,
        salePrice,
        brand: dto.brand || '',
        stock: finalStock,
        weightKg: productWeightKg,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : false,
        variants: {
          create: processedVariants,
        },
      },
    });

    await this.syncProductWithVariants(created.id);
    this.invalidatePublicProductCache();
    return created;
  }

  /**
   * Cập nhật thông tin sản phẩm và đồng bộ lại các phân loại.
   */
  async updateProduct(id: string, dto: UpdateManagerProductInput) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: {
        sellingPrice: true,
        importPrice: true,
        salePrice: true,
        stock: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy sản phẩm.');
    }

    const sellingPrice =
      dto.sellingPrice !== undefined
        ? Number(dto.sellingPrice)
        : existing.sellingPrice;
    const importPrice =
      dto.importPrice !== undefined
        ? dto.importPrice
          ? Number(dto.importPrice)
          : null
        : existing.importPrice;
    const salePrice =
      dto.salePrice !== undefined
        ? dto.salePrice
          ? Number(dto.salePrice)
          : null
        : existing.salePrice;
    const stock =
      dto.stock !== undefined
        ? dto.stock !== null && dto.stock !== ''
          ? Number(dto.stock)
          : existing.stock
        : existing.stock;

    const variants = await this.prisma.productVariant.findMany({
      where: { productId: id },
    });
    const finalStock =
      variants.length > 0
        ? variants.reduce((sum, v) => sum + v.stock, 0)
        : stock;

    // Nếu manager yêu cầu mở bán sản phẩm (dto.isActive === true) nhưng tất cả phân loại đều bị tắt (isActive = false)
    if (dto.isActive === true && variants.length > 0) {
      const hasActiveVariant = variants.some((v) => v.isActive !== false);
      if (!hasActiveVariant) {
        throw new BadRequestException(
          'Không thể mở bán sản phẩm! Vui lòng mở bán ít nhất 1 phân loại (variant) của sản phẩm.',
        );
      }
    }

    // Đồng bộ khuyến mãi xuống toàn bộ phân loại con nếu có thiết lập khuyến mãi
    if (dto.discountType !== undefined && variants.length > 0) {
      if (dto.discountType === 'NONE') {
        await this.prisma.productVariant.updateMany({
          where: { productId: id },
          data: { salePrice: null },
        });
      } else if (dto.discountType === 'PERCENT' && dto.discountValue) {
        const pct = Math.min(100, Math.max(0, Number(dto.discountValue)));
        for (const v of variants) {
          const discounted = Math.max(
            1,
            Math.round((v.sellingPrice * (100 - pct)) / 100),
          );
          await this.prisma.productVariant.update({
            where: { id: v.id },
            data: { salePrice: discounted },
          });
        }
      } else if (dto.discountType === 'AMOUNT' && dto.discountValue) {
        const amt = Math.max(0, Number(dto.discountValue));
        for (const v of variants) {
          const discounted = Math.max(1, v.sellingPrice - amt);
          await this.prisma.productVariant.update({
            where: { id: v.id },
            data: { salePrice: discounted },
          });
        }
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        targetSpecies: dto.targetSpecies,
        description: dto.description,
        imageUrl: dto.imageUrl,
        images: dto.images,
        specifications:
          dto.specifications === null ? Prisma.DbNull : dto.specifications,
        sellingPrice,
        importPrice,
        salePrice,
        brand: dto.brand,
        stock: finalStock,
        weightKg:
          dto.weightKg !== undefined &&
          dto.weightKg !== null &&
          dto.weightKg !== ''
            ? Number(dto.weightKg)
            : undefined,
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
      },
    });

    await this.syncProductWithVariants(id);
    this.invalidatePublicProductCache();
    return updated;
  }

  async deleteProduct(id: string) {
    try {
      // Check if product is referenced in order items
      const orderCount = await this.prisma.orderItem.count({
        where: { productId: id },
      });
      if (orderCount > 0) {
        throw new BadRequestException(
          `Không thể xóa sản phẩm này vì đã có ${orderCount} đơn hàng mua sản phẩm này. Bạn nên ngưng kinh doanh (ẩn) sản phẩm thay vì xóa.`,
        );
      }

      // Delete cart items associated with this product first if any
      await this.prisma.cartItem.deleteMany({
        where: { productId: id },
      });

      const deleted = await this.prisma.product.delete({
        where: { id },
      });
      this.invalidatePublicProductCache();
      return deleted;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error(`Lỗi khi xóa sản phẩm ${id}:`, error);
      throw new BadRequestException(
        'Không thể xóa sản phẩm này do đã phát sinh lịch sử đơn hàng hoặc đánh giá liên quan. Bạn có thể ẩn sản phẩm thay vì xóa.',
      );
    }
  }

  async getOrders() {
    const storeId = await this.getConfiguredStoreId();
    const orders = await this.prisma.order.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      include: {
        payment: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return orders
      .filter(
        (o) => !(o.payment?.method === 'QR' && o.payment.status === 'PENDING'),
      )
      .map((order) => ({
        ...order,
        user:
          order.user ||
          (order.customerNameSnapshot ||
          order.customerEmailSnapshot ||
          order.customerPhoneSnapshot
            ? {
                id: null,
                name: order.customerNameSnapshot || 'Tài khoản đã xóa',
                email: order.customerEmailSnapshot || '',
                phone: order.customerPhoneSnapshot,
              }
            : null),
      }));
  }

  async uploadRefundProof(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('Không có file ảnh nào được gửi lên.');
    }
    const result = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      'petmatching/refund_proofs',
    );
    return { url: result.url };
  }

  /**
   * Cập nhật trạng thái đơn hàng từ trang quản lý Store Manager.
   * Quy tắc nghiệp vụ: Tuyệt đối không cho phép chuyển thủ công sang trạng thái DELIVERED (Đã nhận hàng / Giao thành công).
   * Trạng thái DELIVERED bắt buộc phải được kích hoạt tự động từ hệ thống vận chuyển AhaMove Sandbox khi tài xế giao hoàn tất.
   */
  async updateOrderStatus(
    id: string,
    status: string,
    deliveryProofUrl?: string,
    shippingNote?: string,
  ) {
    // Không cho phép Manager chuyển trạng thái sang DELIVERED (Đã nhận hàng)
    if (status === 'DELIVERED') {
      throw new BadRequestException(
        'Không thể chuyển thủ công sang trạng thái Đã nhận hàng (DELIVERED) từ trang của Manager. Trạng thái này chỉ được cập nhật tự động từ hệ thống AhaMove Sandbox khi tài xế hoàn tất giao hàng.',
      );
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true, payment: true },
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng.');
      }

      // Nếu đơn hàng đã hoàn tất (DELIVERED) qua AhaMove, không cho phép thay đổi trạng thái từ Manager
      if (order.status === 'DELIVERED') {
        throw new BadRequestException(
          'Đơn hàng đã ở trạng thái Giao hàng thành công (DELIVERED) từ AhaMove và không thể chỉnh sửa trạng thái nữa.',
        );
      }

      // If transition to CANCELLED from a non-CANCELLED state
      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            });
            await this.syncProductWithVariants(item.productId, tx);
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            });
          }
        }

        // Restore voucher usedCount if order used a voucher
        if (order.voucherCode) {
          const voucher = await tx.voucher.findUnique({
            where: { code: order.voucherCode },
          });
          if (voucher && voucher.usedCount > 0) {
            await tx.voucher.update({
              where: { id: voucher.id },
              data: {
                usedCount: {
                  decrement: 1,
                },
              },
            });
          }
        }
      }
      // If transition FROM CANCELLED to something else
      else if (order.status === 'CANCELLED' && status !== 'CANCELLED') {
        for (const item of order.items) {
          if (item.variantId) {
            const variant = await tx.productVariant.findUnique({
              where: { id: item.variantId },
            });
            if (!variant) {
              throw new NotFoundException(
                `Không tìm thấy biến thể sản phẩm cho mã ${item.variantId}.`,
              );
            }
            if (variant.stock < item.quantity) {
              throw new BadRequestException(
                `Không thể đổi trạng thái đơn hàng. Biến thể "${variant.name}" hiện không đủ hàng trong kho (chỉ còn ${variant.stock} cái).`,
              );
            }

            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            });
            await this.syncProductWithVariants(item.productId, tx);
          } else {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });
            if (
              product &&
              product.stock !== null &&
              product.stock !== undefined &&
              product.stock < item.quantity
            ) {
              throw new BadRequestException(
                `Không thể đổi trạng thái đơn hàng. Sản phẩm "${product.name}" hiện không đủ hàng trong kho (chỉ còn ${product.stock} cái).`,
              );
            }

            if (
              product &&
              product.stock !== null &&
              product.stock !== undefined
            ) {
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  stock: {
                    decrement: item.quantity,
                  },
                },
              });
            }
          }
        }
      }

      const updateData: Prisma.OrderUpdateInput = {
        status: status as OrderStatus,
      };
      if (deliveryProofUrl !== undefined) {
        updateData.deliveryProofUrl = deliveryProofUrl;
      }
      if (shippingNote !== undefined) {
        updateData.shippingNote = shippingNote;
      }

      if (order.payment) {
        if (
          status === 'DELIVERED' &&
          order.payment.method === 'COD' &&
          order.payment.status !== 'PAID'
        ) {
          await tx.payment.update({
            where: { id: order.payment.id },
            data: { status: 'PAID', paidAt: new Date() },
          });
        } else if (status === 'CANCELLED' && order.payment.status !== 'PAID') {
          await tx.payment.update({
            where: { id: order.payment.id },
            data: { status: 'CANCELLED' },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: updateData,
        include: { payment: true },
      });

      if (order.status !== updatedOrder.status && order.userId) {
        await this.notifications.create(
          {
            userId: order.userId,
            category: NotificationCategory.ORDER,
            eventType: NotificationEventType.ORDER_STATUS_CHANGED,
            title: 'Đơn hàng đã cập nhật',
            content: `Đơn hàng #${order.id.slice(-8).toUpperCase()} đã chuyển sang trạng thái ${ORDER_STATUS_LABELS[updatedOrder.status]}.`,
            targetUrl: `/orders?orderId=${order.id}`,
            entityType: 'ORDER',
            entityId: order.id,
          },
          tx,
        );
      }

      return updatedOrder;
    });
    this.invalidatePublicProductCache();
    return updatedOrder;
  }

  /**
   * Lấy danh sách khách hàng đã từng mua hàng, ẩn email, chuẩn hóa sđt ******1234
   */
  async getCustomers() {
    const users = await this.prisma.user.findMany({
      where: {
        role: 'USER',
        orders: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        orders: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            payment: {
              select: { status: true },
            },
            items: {
              select: {
                id: true,
                quantity: true,
                price: true,
                product: {
                  select: { name: true },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return users.map((u) => {
      const completedOrders = u.orders.filter(
        (o) => o.payment?.status === 'PAID',
      );
      const cancelledOrders = u.orders.filter((o) => o.status === 'CANCELLED');

      const totalOrders = completedOrders.length;
      const totalCancelled = cancelledOrders.length;
      const spent = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      // Định dạng số điện thoại ẩn thành ******1234
      let maskedPhone = 'N/A';
      if (u.phone && u.phone.trim()) {
        const clean = u.phone.replace(/\s+/g, '');
        const last4 = clean.slice(-4);
        maskedPhone = `******${last4}`;
      }

      return {
        id: u.id,
        name: u.name,
        phone: maskedPhone,
        totalOrders,
        totalCancelled,
        spent,
        orders: u.orders.map((o) => ({
          id: o.id,
          status: o.status,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt.toISOString(),
          items: o.items.map((item) => ({
            id: item.id,
            productName: item.product.name,
            quantity: item.quantity,
            price: item.price,
          })),
        })),
      };
    });
  }

  async createCategory(dto: { name: string }) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Tên danh mục không được để trống.');
    }
    const name = dto.name.trim();
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } },
        ],
      },
    });
    if (existing) {
      throw new BadRequestException('Danh mục này đã tồn tại.');
    }

    const createdCategory = await this.prisma.category.create({
      data: {
        name,
        slug,
      },
    });
    this.invalidatePublicProductCache();
    return createdCategory;
  }

  async updateCategory(id: string, dto: { name: string }) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Tên danh mục không được để trống.');
    }
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục.');
    }

    const name = dto.name.trim();
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    const existing = await this.prisma.category.findFirst({
      where: {
        id: { not: id },
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } },
        ],
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Danh mục với tên hoặc slug này đã tồn tại.',
      );
    }

    const oldSlug = category.slug;

    const updatedCategory = await this.prisma.$transaction(async (tx) => {
      // 1. Update the category itself
      const updatedCategory = await tx.category.update({
        where: { id },
        data: { name, slug },
      });

      // 2. Update all products referencing this category slug
      if (oldSlug !== slug) {
        await tx.product.updateMany({
          where: { category: oldSlug },
          data: { category: slug },
        });
      }

      return updatedCategory;
    });
    this.invalidatePublicProductCache();
    return updatedCategory;
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục.');
    }

    // Check if there are any products with this category slug
    const productCount = await this.prisma.product.count({
      where: { category: category.slug },
    });
    if (productCount > 0) {
      throw new BadRequestException(
        'Không thể xóa danh mục này vì đang có sản phẩm thuộc danh mục.',
      );
    }

    const deletedCategory = await this.prisma.category.delete({
      where: { id },
    });
    this.invalidatePublicProductCache();
    return deletedCategory;
  }

  async approveRefund(orderId: string, refundProofUrl?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    if (order.refundStatus !== 'PENDING' && order.refundStatus !== 'FAILED') {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ hoàn tiền hoặc hoàn tiền lỗi.',
      );
    }

    if (!order.refundBankCode || !order.refundAccountNumber) {
      throw new BadRequestException(
        'Thông tin tài khoản nhận tiền hoàn không đầy đủ.',
      );
    }

    try {
      // Update order status and restore stock in transaction
      return await this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }

        if (order.payment) {
          await tx.payment.update({
            where: { id: order.payment.id },
            data: { status: 'REFUNDED', refundedAt: new Date() },
          });
        }

        const updateData: Prisma.OrderUpdateInput = {
          status: 'CANCELLED',
          refundStatus: 'REFUNDED',
          refundedAt: new Date(),
        };

        if (refundProofUrl !== undefined) {
          updateData.refundProofUrl = refundProofUrl;
        }
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: updateData,
        });
        if (order.status !== updatedOrder.status && order.userId) {
          await this.notifications.create(
            {
              userId: order.userId,
              category: NotificationCategory.ORDER,
              eventType: NotificationEventType.ORDER_STATUS_CHANGED,
              title: 'Đơn hàng đã hủy và hoàn tiền',
              content: `Yêu cầu hoàn tiền cho đơn #${order.id.slice(-8).toUpperCase()} đã được duyệt.`,
              targetUrl: `/orders?orderId=${order.id}`,
              entityType: 'ORDER',
              entityId: order.id,
            },
            tx,
          );
        }
        return updatedOrder;
      });
    } catch (error) {
      console.error('Approve refund failed:', error);
      throw new BadRequestException(
        `Phê duyệt hoàn tiền thất bại: ${error.message || 'Lỗi không xác định'}.`,
      );
    }
  }

  async rejectRefund(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    if (order.refundStatus !== 'PENDING' && order.refundStatus !== 'FAILED') {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ hoàn tiền hoặc hoàn tiền lỗi.',
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'FAILED',
      },
    });
  }

  async updateRefundProof(orderId: string, refundProofUrl: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        refundProofUrl: refundProofUrl || null,
      },
    });
  }

  async importProducts(
    file: Express.Multer.File,
    imageFiles: Express.Multer.File[] = [],
  ) {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file tải lên.');
    }

    let workbook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException(
        'File không đúng định dạng Excel (.xlsx hoặc .xls).',
      );
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet);

    if (rawRows.length === 0) {
      throw new BadRequestException(
        'File Excel trống hoặc không chứa dữ liệu.',
      );
    }

    const storeId = await this.getConfiguredStoreId();

    let updatedCount = 0;
    let createdCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i] as any;
      const rowNum = i + 2; // Dòng thứ i+2 trong Excel do có dòng tiêu đề

      const name = (row['Tên sản phẩm'] ?? row['Tên SP'] ?? row['name'] ?? '')
        .toString()
        .trim();
      const variantNameExplicit = (
        row['Phân loại'] ??
        row['Tên phân loại'] ??
        row['Biến thể'] ??
        row['Tên biến thể'] ??
        row['Kích cỡ'] ??
        row['Màu sắc'] ??
        row['variant'] ??
        row['variantName'] ??
        ''
      )
        .toString()
        .trim();
      const categoryStr = (row['Danh mục'] ?? row['category'] ?? '')
        .toString()
        .trim();
      const sellingPriceRaw = row['Giá bán'] ?? row['sellingPrice'];
      const importPriceRaw = row['Giá nhập'] ?? row['importPrice'];
      const quantityRaw =
        row['Số lượng nhập'] ??
        row['Số lượng'] ??
        row['Tồn kho'] ??
        row['quantity'] ??
        row['stock'] ??
        0;
      const brand =
        (row['Thương hiệu'] ?? row['brand'] ?? '').toString().trim() || null;
      const salePriceRaw = row['Giá khuyến mãi'] ?? row['salePrice'];
      const description =
        (row['Mô tả'] ?? row['description'] ?? '').toString().trim() || null;
      const targetSpecies = (
        row['Loài mục tiêu'] ??
        row['targetSpecies'] ??
        'ALL'
      )
        .toString()
        .trim()
        .toUpperCase();
      const id = row['Mã sản phẩm'] ?? row['Mã SP'] ?? row['id'] ?? null;
      const specsRaw = row['Thông số kỹ thuật'] ?? row['specifications'] ?? '';
      const weightKgRaw =
        row['Trọng lượng (kg)'] ??
        row['Trọng lượng'] ??
        row['Cân nặng (kg)'] ??
        row['Cân nặng'] ??
        row['weight'] ??
        row['weightKg'];
      const parsedWeight = Number(weightKgRaw);
      const weightKg =
        !isNaN(parsedWeight) && parsedWeight > 0 ? parsedWeight : 0.5;

      if (!name) {
        errors.push(`Dòng ${rowNum}: Tên sản phẩm không được để trống.`);
        continue;
      }
      if (!categoryStr) {
        errors.push(`Dòng ${rowNum}: Danh mục không được để trống.`);
        continue;
      }

      const sellingPrice = Number(sellingPriceRaw);
      const importPrice = Number(importPriceRaw);
      const quantity = Number(quantityRaw);
      const salePrice =
        salePriceRaw !== undefined &&
        salePriceRaw !== null &&
        salePriceRaw !== ''
          ? Number(salePriceRaw)
          : null;

      if (isNaN(sellingPrice) || sellingPrice <= 0) {
        errors.push(`Dòng ${rowNum}: Giá bán không hợp lệ.`);
        continue;
      }
      if (isNaN(importPrice) || importPrice <= 0) {
        errors.push(`Dòng ${rowNum}: Giá nhập không hợp lệ.`);
        continue;
      }
      if (isNaN(quantity) || quantity < 0) {
        errors.push(`Dòng ${rowNum}: Số lượng nhập không hợp lệ.`);
        continue;
      }
      if (importPrice > sellingPrice) {
        errors.push(
          `Dòng ${rowNum}: Giá nhập (${importPrice}) không được lớn hơn giá bán (${sellingPrice}).`,
        );
        continue;
      }

      const species = ['DOG', 'CAT', 'ALL'].includes(targetSpecies)
        ? targetSpecies
        : 'ALL';

      // Parse specifications from comma separated color: blue, size: L
      let specifications = null;
      if (specsRaw && specsRaw.toString().trim()) {
        try {
          const parts = specsRaw.toString().split(',');
          const obj: any = {};
          for (const part of parts) {
            const [key, val] = part.split(':');
            if (key && val) {
              obj[key.trim()] = val.trim();
            }
          }
          specifications = obj;
        } catch {
          errors.push(
            `Dòng ${rowNum}: Cảnh báo: Lỗi định dạng thông số kỹ thuật (Cần dạng: Thuộc tính 1: Giá trị 1, Thuộc tính 2: Giá trị 2).`,
          );
        }
      }

      const categorySlug = categoryStr
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-zA-Z0-9\s-_]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .toUpperCase();

      await this.prisma.category.upsert({
        where: { slug: categorySlug },
        update: {},
        create: {
          name: categoryStr,
          slug: categorySlug,
        },
      });

      let productName = name;
      let variantName = variantNameExplicit;

      if (!variantName) {
        const match = name.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) {
          productName = match[1].trim();
          variantName = match[2].trim();
        }
      }

      let product = null;
      if (id) {
        product = await this.prisma.product.findUnique({
          where: { id: id.toString().trim() },
          include: { variants: true },
        });
      }

      const generatedSlug = this.generateSlug(productName);
      if (!product) {
        product = await this.prisma.product.findFirst({
          where: {
            OR: [{ slug: generatedSlug }, { name: productName }],
          },
          include: { variants: true },
        });
      }

      const cleanIdForImage = id ? id.toString().trim() : '';
      const cleanSlugForImage = generatedSlug.toLowerCase();
      const cleanVariantName = variantName
        ? variantName.trim().toLowerCase()
        : '';
      const cleanVariantSlug = variantName
        ? variantName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[đĐ]/g, 'd')
            .replace(/[^a-z0-9]/g, '')
        : '';

      // 1. Search for variant specific image files (Folder: ID-VariantName e.g. 128222-Size M or filename ID-VariantName.jpg)
      let variantImageUrl: string | null = null;
      if (variantName) {
        const matchedVariantImageFile = imageFiles.find((img) => {
          const pathLower = img.originalname.toLowerCase().replace(/\\/g, '/');
          const fileNameNoExt = pathLower.split('/').pop()?.split('.')[0] || '';
          const folderParts = pathLower.split('/');
          const folderName =
            folderParts.length > 1 ? folderParts[folderParts.length - 2] : '';

          const cleanFolder = folderName.trim().toLowerCase();
          const cleanId = cleanIdForImage.toLowerCase();

          if (cleanFolder) {
            if (
              (cleanId && cleanFolder === `${cleanId}-${cleanVariantName}`) ||
              (cleanId && cleanFolder === `${cleanId}_${cleanVariantName}`) ||
              (cleanId && cleanFolder === `${cleanId}-${cleanVariantSlug}`) ||
              (cleanId && cleanFolder === `${cleanId}_${cleanVariantSlug}`) ||
              cleanFolder.endsWith(`-${cleanVariantName}`) ||
              cleanFolder.endsWith(`_${cleanVariantName}`) ||
              cleanFolder.endsWith(`-${cleanVariantSlug}`) ||
              cleanFolder.endsWith(`_${cleanVariantSlug}`)
            ) {
              return true;
            }
          }

          if (
            (cleanId && pathLower.includes(`${cleanId}-${cleanVariantName}`)) ||
            (cleanId && pathLower.includes(`${cleanId}_${cleanVariantName}`)) ||
            (cleanId && pathLower.includes(`${cleanId}-${cleanVariantSlug}`)) ||
            (cleanId && pathLower.includes(`${cleanId}_${cleanVariantSlug}`)) ||
            (cleanVariantSlug && fileNameNoExt.includes(cleanVariantSlug))
          ) {
            return true;
          }

          return false;
        });

        if (matchedVariantImageFile) {
          try {
            const uploadRes = await this.cloudinaryService.uploadBuffer(
              matchedVariantImageFile.buffer,
              'products',
            );
            variantImageUrl = uploadRes.url;
          } catch (err) {
            errors.push(
              `Dòng ${rowNum}: Cảnh báo: Lỗi khi tải ảnh biến thể ${matchedVariantImageFile.originalname} lên Cloudinary: ${err.message || err}`,
            );
          }
        }
      }

      // 2. Search for main product image files (Folder: ID e.g. 128222 or filename 128222_1.jpg)
      const matchedImages = imageFiles.filter((img) => {
        const pathLower = img.originalname.toLowerCase().replace(/\\/g, '/');
        const folderParts = pathLower.split('/');
        const folderName =
          folderParts.length > 1 ? folderParts[folderParts.length - 2] : '';

        const cleanId = cleanIdForImage.toLowerCase();
        const cleanFolder = folderName.trim().toLowerCase();

        // Exclude variant folder files
        if (cleanFolder.includes('-') || cleanFolder.includes('_')) {
          if (
            cleanId &&
            (cleanFolder.startsWith(`${cleanId}-`) ||
              cleanFolder.startsWith(`${cleanId}_`))
          ) {
            return false;
          }
        }

        const isProductFolder = cleanId && cleanFolder === cleanId;
        const isProductFile =
          (cleanId &&
            (pathLower.includes(`/${cleanId}_`) ||
              pathLower.includes(`/${cleanId}-`) ||
              pathLower.includes(`/${cleanId}.`))) ||
          pathLower.includes(cleanSlugForImage);

        return isProductFolder || isProductFile;
      });

      const imageUrls: string[] = [];
      for (const img of matchedImages) {
        try {
          const uploadRes = await this.cloudinaryService.uploadBuffer(
            img.buffer,
            'products',
          );
          imageUrls.push(uploadRes.url);
        } catch (err) {
          errors.push(
            `Dòng ${rowNum}: Cảnh báo: Lỗi khi tải ảnh ${img.originalname} lên Cloudinary: ${err.message || err}`,
          );
        }
      }

      // Check if product exists and has variants, or if we have a variantName
      if (product && (product.variants.length > 0 || variantName)) {
        let matchedVariant = null;
        if (variantName) {
          matchedVariant = product.variants.find(
            (v) => v.name.toLowerCase() === variantName.toLowerCase(),
          );
        }
        if (!matchedVariant && !variantName) {
          // If no variant name is in parentheses or column, try to match the row's whole name with a variant name
          matchedVariant = product.variants.find(
            (v) => v.name.toLowerCase() === name.toLowerCase(),
          );
        }

        if (!matchedVariant && variantName) {
          // Auto-create new variant
          matchedVariant = await this.prisma.productVariant.create({
            data: {
              productId: product.id,
              name: variantName,
              sellingPrice,
              importPrice,
              salePrice: salePrice || null,
              stock: quantity,
              weightKg,
              attributes: { variant: variantName },
              imageUrl:
                variantImageUrl || (imageUrls.length > 0 ? imageUrls[0] : null),
              isActive: true,
            },
          });
        }

        if (matchedVariant) {
          const currentVariantStock = matchedVariant.stock ?? 0;
          await this.prisma.productVariant.update({
            where: { id: matchedVariant.id },
            data: {
              sellingPrice,
              importPrice,
              salePrice: salePrice || null,
              stock: currentVariantStock + quantity,
              weightKg,
              imageUrl:
                variantImageUrl ||
                (imageUrls.length > 0 ? imageUrls[0] : matchedVariant.imageUrl),
            },
          });
        } else if (product.variants.length > 0) {
          // If product has variants, but no variant name matched, add stock to the first variant
          const firstVariant = product.variants[0];
          const currentVariantStock = firstVariant.stock ?? 0;
          await this.prisma.productVariant.update({
            where: { id: firstVariant.id },
            data: {
              importPrice,
              stock: currentVariantStock + quantity,
              weightKg,
              imageUrl: variantImageUrl || firstVariant.imageUrl,
            },
          });
        }

        // Recalculate main product total stock and update it
        const allVariants = await this.prisma.productVariant.findMany({
          where: { productId: product.id },
        });
        const totalVariantStock = allVariants.reduce(
          (sum, v) => sum + v.stock,
          0,
        );

        await this.prisma.product.update({
          where: { id: product.id },
          data: {
            sellingPrice,
            importPrice,
            salePrice: salePrice || null,
            stock: totalVariantStock,
            weightKg,
            brand: brand || product.brand,
            description: description || product.description,
            category: categorySlug,
            targetSpecies: species,
            specifications: specifications || product.specifications,
            imageUrl: imageUrls.length > 0 ? imageUrls[0] : product.imageUrl,
            images: imageUrls.length > 0 ? imageUrls : product.images,
          },
        });
        updatedCount++;
      } else {
        // Standard product import without variants
        if (product) {
          const currentStock = product.stock ?? 0;
          await this.prisma.product.update({
            where: { id: product.id },
            data: {
              sellingPrice,
              importPrice,
              salePrice: salePrice || null,
              stock: currentStock + quantity,
              weightKg,
              brand: brand || product.brand,
              description: description || product.description,
              category: categorySlug,
              targetSpecies: species,
              specifications: specifications || product.specifications,
              imageUrl: imageUrls.length > 0 ? imageUrls[0] : product.imageUrl,
              images: imageUrls.length > 0 ? imageUrls : product.images,
            },
          });
          updatedCount++;
        } else {
          const newId = id
            ? id.toString().trim()
            : await this.generateProductId();
          const newProduct = await this.prisma.product.create({
            data: {
              id: newId,
              storeId,
              name: productName,
              slug: generatedSlug,
              category: categorySlug,
              targetSpecies: species,
              sellingPrice,
              importPrice,
              salePrice: salePrice || null,
              stock: quantity,
              weightKg,
              brand: brand || '',
              description: description || '',
              isActive: true,
              isFeatured: false,
              specifications: specifications || null,
              imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
              images: imageUrls.length > 0 ? imageUrls : [],
            },
          });

          if (variantName) {
            // Khởi tạo phân loại biến thể mới cho sản phẩm vừa tạo
            await this.prisma.productVariant.create({
              data: {
                productId: newProduct.id,
                name: variantName,
                sellingPrice,
                importPrice,
                salePrice: salePrice || null,
                stock: quantity,
                weightKg,
                attributes: { variant: variantName },
                imageUrl:
                  variantImageUrl ||
                  (imageUrls.length > 0 ? imageUrls[0] : null),
                isActive: true,
              },
            });
          }
          createdCount++;
        }
      }
    }

    this.invalidatePublicProductCache();
    return {
      success: true,
      updatedCount,
      createdCount,
      errors,
    };
  }

  async exportOrdersToExcel(filters: {
    startDate?: string;
    endDate?: string;
    onlyRefunded?: boolean;
  }): Promise<Buffer> {
    const storeId = await this.getConfiguredStoreId();
    const where: Prisma.OrderWhereInput = { storeId };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (filters.onlyRefunded) {
      where.refundStatus = 'REFUNDED';
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true, phone: true },
        },
        items: {
          include: {
            product: {
              select: { name: true, importPrice: true },
            },
          },
        },
      },
    });

    // Fetch banks mapping to translate BIN to shortName
    const bankMap = new Map<string, string>();
    try {
      const bankRes = await fetch('https://api.vietqr.io/v2/banks').then((r) =>
        r.json(),
      );
      if (bankRes && bankRes.code === '00' && Array.isArray(bankRes.data)) {
        for (const b of bankRes.data) {
          bankMap.set(b.bin, `${b.shortName} - ${b.name}`);
        }
      }
    } catch (e) {
      console.error('Failed to fetch bank list for Excel export mapping', e);
    }

    const exportData = orders.map((o) => {
      let name = o.user?.name || o.customerNameSnapshot || '';
      let phone = o.user?.phone || o.customerPhoneSnapshot || '';
      let address = o.shippingAddress;
      try {
        if (o.shippingAddress.startsWith('{')) {
          const parsed = JSON.parse(o.shippingAddress);
          name = parsed.name || name;
          phone = parsed.phone || phone;
          address = `${parsed.address}, ${parsed.ward}, ${parsed.district}, ${parsed.province}`;
        }
      } catch {
        // use raw address
      }

      const itemsList = o.items
        .map((i) => `${i.product?.name || 'Sản phẩm'} (x${i.quantity})`)
        .join(', ');

      // Nhãn tiếng Việt tương ứng cho báo cáo đơn hàng (chuẩn AhaMove mới)
      const statusLabels: Record<string, string> = {
        PENDING: 'Xác nhận',
        PACKED: 'Đã gói hàng',
        PROCESSING: 'Đã gói hàng',
        SHIPPED: 'Đã gửi VC',
        DELIVERED: 'Giao hàng thành công',
        CANCELLED: 'Đã hủy',
      };

      return {
        'Mã đơn hàng': o.id,
        'Khách hàng': name,
        SĐT: phone,
        'Địa chỉ giao hàng': address,
        'Ngày đặt': new Date(o.createdAt).toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        'Sản phẩm': itemsList,
        'Tổng thanh toán': o.totalAmount,
        'Trạng thái': statusLabels[o.status] || o.status,
        'Ghi chú vận chuyển': o.shippingNote || '',
        'STK Nhận hoàn tiền': o.refundAccountNumber || '',
        'Ngân hàng Nhận hoàn tiền': o.refundBankCode
          ? bankMap.get(o.refundBankCode) || o.refundBankCode
          : '',
        'Chủ tài khoản Nhận hoàn tiền': o.refundAccountName || '',
        'Ngày hoàn tiền': o.refundedAt
          ? new Date(o.refundedAt).toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : '',
      };
    });

    const workbook = createWorkbook();
    appendJsonSheet(workbook, 'Danh sách đơn hàng', exportData);
    return writeWorkbook(workbook);
  }

  async getProductVariants(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createProductVariant(
    productId: string,
    dto: ManagerProductVariantInput,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm chính.');
    }

    const sellingPrice = dto.sellingPrice
      ? Number(dto.sellingPrice)
      : product.sellingPrice;
    const salePrice = dto.salePrice ? Number(dto.salePrice) : null;
    const stock =
      dto.stock !== undefined && dto.stock !== null && dto.stock !== ''
        ? Number(dto.stock)
        : 0;

    const importPrice = dto.importPrice ? Number(dto.importPrice) : null;

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      throw new BadRequestException('Giá bán phải là số lớn hơn 0.');
    }
    if (salePrice !== null && (isNaN(salePrice) || salePrice <= 0)) {
      throw new BadRequestException('Giá khuyến mãi phải là số lớn hơn 0.');
    }
    if (salePrice !== null && salePrice > sellingPrice) {
      throw new BadRequestException(
        'Giá khuyến mãi không được lớn hơn giá bán.',
      );
    }
    if (isNaN(stock) || stock < 0) {
      throw new BadRequestException('Số lượng tồn kho phải là số không âm.');
    }

    const weightKg =
      dto.weightKg !== undefined && dto.weightKg !== null && dto.weightKg !== ''
        ? Number(dto.weightKg)
        : (product.weightKg ?? 0.5);

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name,
        sellingPrice,
        salePrice,
        importPrice,
        stock,
        weightKg,
        imageUrl: dto.imageUrl || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.syncProductWithVariants(productId);
    this.invalidatePublicProductCache();
    return variant;
  }

  async updateProductVariant(
    variantId: string,
    dto: ManagerProductVariantInput,
  ) {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy biến thể sản phẩm.');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: existing.productId },
    });
    const fallbackSellingPrice = product ? product.sellingPrice : 0;

    const sellingPrice =
      dto.sellingPrice !== undefined
        ? dto.sellingPrice
          ? Number(dto.sellingPrice)
          : fallbackSellingPrice
        : existing.sellingPrice;
    const salePrice =
      dto.salePrice !== undefined
        ? dto.salePrice
          ? Number(dto.salePrice)
          : null
        : existing.salePrice;
    const importPrice =
      dto.importPrice !== undefined
        ? dto.importPrice
          ? Number(dto.importPrice)
          : null
        : existing.importPrice;
    const stock =
      dto.stock !== undefined
        ? dto.stock !== null && dto.stock !== ''
          ? Number(dto.stock)
          : existing.stock
        : existing.stock;
    const weightKg =
      dto.weightKg !== undefined
        ? dto.weightKg !== null && dto.weightKg !== ''
          ? Number(dto.weightKg)
          : existing.weightKg
        : existing.weightKg;

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      throw new BadRequestException('Giá bán phải là số lớn hơn 0.');
    }
    if (salePrice !== null && (isNaN(salePrice) || salePrice <= 0)) {
      throw new BadRequestException('Giá khuyến mãi phải là số lớn hơn 0.');
    }
    if (salePrice !== null && salePrice > sellingPrice) {
      throw new BadRequestException(
        'Giá khuyến mãi không được lớn hơn giá bán.',
      );
    }
    if (isNaN(stock) || stock < 0) {
      throw new BadRequestException('Số lượng tồn kho phải là số không âm.');
    }

    const variant = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        name: dto.name,
        sellingPrice,
        salePrice,
        importPrice,
        stock,
        weightKg,
        imageUrl:
          dto.imageUrl !== undefined ? dto.imageUrl || null : existing.imageUrl,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.syncProductWithVariants(existing.productId);
    this.invalidatePublicProductCache();
    return variant;
  }

  async deleteProductVariant(variantId: string) {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy biến thể sản phẩm.');
    }

    try {
      const deleted = await this.prisma.productVariant.delete({
        where: { id: variantId },
      });

      await this.syncProductWithVariants(existing.productId);
      this.invalidatePublicProductCache();
      return deleted;
    } catch (error) {
      console.error(`Lỗi khi xóa biến thể ${variantId}:`, error);
      throw new BadRequestException(
        'Không thể xóa biến thể này vì đã phát sinh lịch sử đơn hàng đặt mua biến thể.',
      );
    }
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { recognizedStoreRevenueWhere } from '../../common/revenue.utils';
import { NotificationCategory, NotificationEventType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ORDER_STATUS_LABELS } from '../notifications/notification-status-labels';
import { HANOI_WARDS } from '../matching/hanoi-wards';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';

@Injectable()
export class ManagerService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private readonly notifications: NotificationsService,
  ) {}

  private serializeStoreSettings(store: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    description: string | null;
  }) {
    const address = store.address?.trim() || '';
    const ward = HANOI_WARDS.find(({ name }) => address.includes(name));
    const wardPosition = ward ? address.lastIndexOf(ward.name) : -1;
    const addressDetail =
      wardPosition >= 0
        ? address.slice(0, wardPosition).replace(/,\s*$/, '').trim()
        : address;

    return {
      ...store,
      address,
      addressDetail,
      provinceId: 1,
      provinceName: 'Thành phố Hà Nội',
      wardCode: ward?.wardCode || '',
      wardName: ward?.name || '',
    };
  }

  async getStoreSettings(managerId: string) {
    const store = await this.getOrCreateStore(managerId);
    return this.serializeStoreSettings(store);
  }

  async updateStoreSettings(managerId: string, dto: UpdateStoreSettingsDto) {
    const ward = HANOI_WARDS.find(({ wardCode }) => wardCode === dto.wardCode);
    if (!ward) {
      throw new BadRequestException(
        'Mã phường/xã không thuộc danh sách 126 phường/xã Hà Nội.',
      );
    }

    const store = await this.getOrCreateStore(managerId);
    const updatedStore = await this.prisma.store.update({
      where: { id: store.id },
      data: {
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        address: `${dto.addressDetail.trim()}, ${ward.name}, Thành phố Hà Nội`,
        description: dto.description?.trim() || null,
      },
    });

    return this.serializeStoreSettings(updatedStore);
  }



  private async syncProductWithVariants(productId: string, customTx?: any) {
    const client = customTx || this.prisma;
    const variants = await client.productVariant.findMany({
      where: { productId },
    });

    if (!variants || variants.length === 0) return;

    const totalStock = variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);

    let minVariant = variants[0];
    let minEffectivePrice = (minVariant.salePrice !== null && minVariant.salePrice !== undefined && minVariant.salePrice < minVariant.sellingPrice)
      ? minVariant.salePrice
      : minVariant.sellingPrice;

    for (let i = 1; i < variants.length; i++) {
      const v = variants[i];
      const eff = (v.salePrice !== null && v.salePrice !== undefined && v.salePrice < v.sellingPrice)
        ? v.salePrice
        : v.sellingPrice;
      if (eff < minEffectivePrice) {
        minEffectivePrice = eff;
        minVariant = v;
      }
    }

    await client.product.update({
      where: { id: productId },
      data: {
        stock: totalStock,
        sellingPrice: minVariant.sellingPrice,
        salePrice: minVariant.salePrice,
        ...(minVariant.importPrice ? { importPrice: minVariant.importPrice } : {}),
      },
    });
  }

  private async syncProductStock(productId: string) {
    return this.syncProductWithVariants(productId);
  }

  private async syncProductStockTx(tx: any, productId: string) {
    return this.syncProductWithVariants(productId, tx);
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

  async getOrCreateStore(managerId: string) {
    let store = await this.prisma.store.findFirst({
      where: { managerId },
    });
    if (!store) {
      store = await this.prisma.store.create({
        data: {
          name: 'Cửa hàng PetMatching Hà Nội',
          phone: '0987654321',
          address: 'Số 1 Tràng Tiền, Phường Hoàn Kiếm, Thành phố Hà Nội',
          status: 'ACTIVE',
          managerId,
        },
      });
    }
    return store;
  }

  async getDashboardStats(managerId: string) {
    const store = await this.prisma.store.findFirst({
      where: { managerId },
      select: { id: true },
    });
    const revenueOrderWhere = recognizedStoreRevenueWhere(store?.id);
    const revenueSum = await this.prisma.order.aggregate({
      where: revenueOrderWhere,
      _sum: { totalAmount: true },
    });
    const totalRevenue = revenueSum._sum.totalAmount ?? 0;

    // Total orders
    const totalOrders = await this.prisma.order.count();

    // Cancelled orders count
    const cancelledOrders = await this.prisma.order.count({
      where: { status: 'CANCELLED' },
    });

    const cancellationRate =
      totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    // Total products sold: sum order item quantities where order status is not CANCELLED
    const itemsSold = await this.prisma.orderItem.aggregate({
      where: { order: { payment: { status: 'PAID' } } },
      _sum: { quantity: true },
    });
    const totalProductsSold = itemsSold._sum.quantity ?? 0;

    // Total customers
    const totalCustomers = await this.prisma.user.count({
      where: { role: 'USER' },
    });

    // Calculate total profit
    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: revenueOrderWhere },
      select: {
        quantity: true,
        price: true,
        product: {
          select: {
            importPrice: true,
          },
        },
      },
    });

    let totalProfit = 0;
    for (const item of orderItems) {
      const soldPrice = item.price;
      const importPrice = item.product?.importPrice ?? soldPrice * 0.5;
      totalProfit += (soldPrice - importPrice) * item.quantity;
    }

    const profitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalOrders,
      totalProductsSold,
      totalCustomers,
      cancellationRate,
      totalProfit,
      profitMargin,
    };
  }

  async getProducts() {
    const products = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        orderItems: {
          where: { order: { status: { not: 'CANCELLED' } } },
          select: { quantity: true },
        },
        variants: true,
      },
    });

    return products.map((p) => {
      const sales = p.orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const { orderItems, ...rest } = p;
      return {
        ...rest,
        sales,
      };
    });
  }

  private validateProductPrices(
    sellingPrice: number,
    importPrice?: number | null,
    salePrice?: number | null,
    stock?: number,
  ) {
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      throw new BadRequestException('Giá bán phải là số lớn hơn 0.');
    }
    if (
      importPrice !== undefined &&
      importPrice !== null &&
      (isNaN(importPrice) || importPrice <= 0)
    ) {
      throw new BadRequestException('Giá nhập phải là số lớn hơn 0.');
    }
    if (
      salePrice !== undefined &&
      salePrice !== null &&
      (isNaN(salePrice) || salePrice <= 0)
    ) {
      throw new BadRequestException('Giá khuyến mãi phải là số lớn hơn 0.');
    }
    if (
      importPrice !== undefined &&
      importPrice !== null &&
      importPrice > sellingPrice
    ) {
      throw new BadRequestException('Giá nhập không được lớn hơn giá bán.');
    }
    if (
      salePrice !== undefined &&
      salePrice !== null &&
      salePrice > sellingPrice
    ) {
      throw new BadRequestException(
        'Giá khuyến mãi không được lớn hơn giá bán.',
      );
    }
    if (stock !== undefined && stock !== null && (isNaN(stock) || stock < 0)) {
      throw new BadRequestException('Số lượng tồn kho phải là số không âm.');
    }
  }

  async createProduct(dto: any) {
    const slug = this.generateSlug(dto.name);
    const id = await this.generateProductId();
    const store = await this.prisma.store.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!store) {
      throw new BadRequestException('Cửa hàng chưa được cấu hình.');
    }

    const sellingPrice = Number(dto.sellingPrice);
    const importPrice = dto.importPrice ? Number(dto.importPrice) : null;
    const salePrice = dto.salePrice ? Number(dto.salePrice) : null;
    const stock =
      dto.stock !== undefined && dto.stock !== null && dto.stock !== ''
        ? Number(dto.stock)
        : 0;

    this.validateProductPrices(sellingPrice, importPrice, salePrice, stock);

    const hasVariants =
      dto.variants && Array.isArray(dto.variants) && dto.variants.length > 0;
    const finalStock = hasVariants
      ? dto.variants.reduce(
          (sum: number, v: any) => sum + Number(v.stock || 0),
          0,
        )
      : stock;

    const created = await this.prisma.product.create({
      data: {
        id,
        storeId: store.id,
        name: dto.name,
        slug,
        category: dto.category,
        targetSpecies: dto.targetSpecies || 'ALL',
        description: dto.description || '',
        imageUrl: dto.imageUrl || '',
        images: dto.images || [],
        specifications: dto.specifications || {},
        sellingPrice,
        importPrice,
        salePrice,
        brand: dto.brand || '',
        unit: dto.unit || '',
        stock: finalStock,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : false,
        variants: hasVariants
          ? {
              create: dto.variants.map((v: any) => ({
                name: v.name,
                sellingPrice: Number(v.sellingPrice),
                salePrice: v.salePrice ? Number(v.salePrice) : null,
                importPrice: v.importPrice ? Number(v.importPrice) : null,
                stock: Number(v.stock || 0),
                imageUrl: v.imageUrl || null,
                isActive: true,
              })),
            }
          : undefined,
      },
    });

    await this.syncProductWithVariants(created.id);
    return created;
  }

  async updateProduct(id: string, dto: any) {
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

    this.validateProductPrices(
      sellingPrice,
      importPrice,
      salePrice,
      finalStock,
    );

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        targetSpecies: dto.targetSpecies,
        description: dto.description,
        imageUrl: dto.imageUrl,
        images: dto.images,
        specifications: dto.specifications,
        sellingPrice,
        importPrice,
        salePrice,
        brand: dto.brand,
        unit: dto.unit,
        stock: finalStock,
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
      },
    });

    await this.syncProductWithVariants(id);
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

      return await this.prisma.product.delete({
        where: { id },
      });
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
    const orders = await this.prisma.order.findMany({
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

  async uploadDeliveryProof(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('Không có file ảnh nào được gửi lên.');
    }
    const result = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      'petmatching/delivery_proofs',
    );
    return { url: result.url };
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

  async updateOrderStatus(
    id: string,
    status: string,
    deliveryProofUrl?: string,
    shippingNote?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true, payment: true },
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng.');
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
            await this.syncProductStockTx(tx, item.productId);
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
            await this.syncProductStockTx(tx, item.productId);
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

            if (product && product.stock !== null && product.stock !== undefined) {
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

      const updateData: any = { status: status as any };
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
        } else if (
          status === 'CANCELLED' &&
          order.payment.status !== 'PAID'
        ) {
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
  }

  async getCustomers() {
    const users = await this.prisma.user.findMany({
      where: { role: 'USER' },
      include: {
        orders: {
          include: {
            payment: true,
            items: {
              include: {
                product: true,
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
      const isNewCustomer = u.orders.length === 0;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || 'N/A',
        totalOrders,
        totalCancelled,
        spent,
        isNewCustomer,
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

    return this.prisma.category.create({
      data: {
        name,
        slug,
      },
    });
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

    return this.prisma.$transaction(async (tx) => {
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

    return this.prisma.category.delete({
      where: { id },
    });
  }

  async getProductUnits() {
    return this.prisma.productUnit.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProductUnit(dto: { name: string }) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Tên đơn vị tính không được để trống.');
    }
    const name = dto.name.trim();
    const existing = await this.prisma.productUnit.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new BadRequestException('Đơn vị tính này đã tồn tại.');
    }
    return this.prisma.productUnit.create({
      data: { name },
    });
  }

  async updateProductUnit(id: string, dto: { name: string }) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Tên đơn vị tính không được để trống.');
    }
    const unit = await this.prisma.productUnit.findUnique({
      where: { id },
    });
    if (!unit) {
      throw new NotFoundException('Không tìm thấy đơn vị tính.');
    }
    const name = dto.name.trim();
    const existing = await this.prisma.productUnit.findFirst({
      where: {
        id: { not: id },
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new BadRequestException('Đơn vị tính này đã tồn tại.');
    }

    return this.prisma.productUnit.update({
      where: { id },
      data: { name },
    });
  }

  async deleteProductUnit(id: string) {
    const unit = await this.prisma.productUnit.findUnique({
      where: { id },
    });
    if (!unit) {
      throw new NotFoundException('Không tìm thấy đơn vị tính.');
    }

    const productCount = await this.prisma.product.count({
      where: { unit: unit.name },
    });
    if (productCount > 0) {
      throw new BadRequestException(
        'Không thể xóa đơn vị tính này vì đang có sản phẩm sử dụng.',
      );
    }

    return this.prisma.productUnit.delete({
      where: { id },
    });
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

        const updateData: any = {
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
    } catch (e) {
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

    const store = await this.prisma.store.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!store) {
      throw new BadRequestException('Cửa hàng chưa được cấu hình.');
    }

    let updatedCount = 0;
    let createdCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i] as any;
      const rowNum = i + 2; // Dòng thứ i+2 trong Excel do có dòng tiêu đề

      const name = (row['Tên sản phẩm'] ?? row['Tên SP'] ?? row['name'] ?? '').toString().trim();
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
      ).toString().trim();
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
      const unit =
        (row['Đơn vị tính'] ?? row['Đơn vị'] ?? row['unit'] ?? '')
          .toString()
          .trim() || null;
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
        } catch (e) {
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

      // Auto-create product unit in productUnit table if not exists
      if (unit) {
        const unitName = unit.trim();
        const existingUnit = await this.prisma.productUnit.findFirst({
          where: { name: { equals: unitName, mode: 'insensitive' } },
        });
        if (!existingUnit) {
          await this.prisma.productUnit.create({
            data: { name: unitName },
          });
        }
      }

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
      const cleanVariantName = variantName ? variantName.trim().toLowerCase() : '';
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
          const folderName = folderParts.length > 1 ? folderParts[folderParts.length - 2] : '';

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
        const folderName = folderParts.length > 1 ? folderParts[folderParts.length - 2] : '';

        const cleanId = cleanIdForImage.toLowerCase();
        const cleanFolder = folderName.trim().toLowerCase();

        // Exclude variant folder files
        if (cleanFolder.includes('-') || cleanFolder.includes('_')) {
          if (cleanId && (cleanFolder.startsWith(`${cleanId}-`) || cleanFolder.startsWith(`${cleanId}_`))) {
            return false;
          }
        }

        const isProductFolder = cleanId && cleanFolder === cleanId;
        const isProductFile =
          (cleanId && (pathLower.includes(`/${cleanId}_`) || pathLower.includes(`/${cleanId}-`) || pathLower.includes(`/${cleanId}.`))) ||
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
              salePrice: salePrice || null,
              stock: quantity,
              imageUrl: variantImageUrl || (imageUrls.length > 0 ? imageUrls[0] : null),
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
              salePrice: salePrice || null,
              stock: currentVariantStock + quantity,
              imageUrl:
                variantImageUrl || (imageUrls.length > 0 ? imageUrls[0] : matchedVariant.imageUrl),
            },
          });
        } else if (product.variants.length > 0) {
          // If product has variants, but no variant name matched, add stock to the first variant
          const firstVariant = product.variants[0];
          const currentVariantStock = firstVariant.stock ?? 0;
          await this.prisma.productVariant.update({
            where: { id: firstVariant.id },
            data: {
              stock: currentVariantStock + quantity,
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
            brand: brand || product.brand,
            unit: unit || product.unit,
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
              brand: brand || product.brand,
              unit: unit || product.unit,
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
              storeId: store.id,
              name: productName,
              slug: generatedSlug,
              category: categorySlug,
              targetSpecies: species,
              sellingPrice,
              importPrice,
              salePrice: salePrice || null,
              stock: quantity,
              brand: brand || '',
              unit: unit || '',
              description: description || '',
              isActive: true,
              isFeatured: false,
              specifications: specifications || null,
              imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
              images: imageUrls.length > 0 ? imageUrls : [],
            },
          });

          if (variantName) {
            await this.prisma.productVariant.create({
              data: {
                productId: newProduct.id,
                name: variantName,
                sellingPrice,
                salePrice: salePrice || null,
                stock: quantity,
                imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
                isActive: true,
              },
            });
          }
          createdCount++;
        }
      }
    }

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
  }) {
    const where: any = {};

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
      } catch (e) {
        // use raw address
      }

      const itemsList = o.items
        .map((i) => `${i.product?.name || 'Sản phẩm'} (x${i.quantity})`)
        .join(', ');

      let orderProfit = 0;
      for (const i of o.items) {
        const soldPrice = i.price;
        const importPrice = i.product?.importPrice ?? soldPrice * 0.5;
        orderProfit += (soldPrice - importPrice) * i.quantity;
      }

      const statusLabels: Record<string, string> = {
        PENDING: 'Chờ xác nhận',
        PACKED: 'Đã gói hàng',
        PROCESSING: 'Đã gói hàng',
        SHIPPED: 'Đã gửi bên vận chuyển',
        DELIVERED: 'Đã nhận hàng',
        CANCELLED: 'Đã hủy',
      };

      return {
        'Mã đơn hàng': o.id,
        'Khách hàng': name,
        SĐT: phone,
        'Địa chỉ giao hàng': address,
        'Ngày đặt': new Date(o.createdAt).toLocaleDateString('vi-VN'),
        'Sản phẩm': itemsList,
        'Tổng thanh toán': o.totalAmount,
        'Lợi nhuận đơn': orderProfit,
        'Trạng thái': statusLabels[o.status] || o.status,
        'Ghi chú vận chuyển': o.shippingNote || '',
        'STK Nhận hoàn tiền': o.refundAccountNumber || '',
        'Ngân hàng Nhận hoàn tiền': o.refundBankCode
          ? bankMap.get(o.refundBankCode) || o.refundBankCode
          : '',
        'Chủ tài khoản Nhận hoàn tiền': o.refundAccountName || '',
        'Ngày hoàn tiền': o.refundedAt
          ? new Date(o.refundedAt).toLocaleDateString('vi-VN')
          : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách đơn hàng');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  async getProductVariants(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
  }



  async createProductVariant(productId: string, dto: any) {
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

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name,
        sellingPrice,
        salePrice,
        importPrice,
        stock,
        imageUrl: dto.imageUrl || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.syncProductStock(productId);
    return variant;
  }

  async updateProductVariant(variantId: string, dto: any) {
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
        imageUrl:
          dto.imageUrl !== undefined ? dto.imageUrl || null : existing.imageUrl,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.syncProductStock(existing.productId);
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

      await this.syncProductStock(existing.productId);
      return deleted;
    } catch (error) {
      console.error(`Lỗi khi xóa biến thể ${variantId}:`, error);
      throw new BadRequestException(
        'Không thể xóa biến thể này vì đã phát sinh lịch sử đơn hàng đặt mua biến thể.',
      );
    }
  }
}

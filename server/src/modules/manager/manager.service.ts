import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ManagerService {
  constructor(private prisma: PrismaService) {}

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

    throw new BadRequestException('Không thể tạo mã sản phẩm. Vui lòng thử lại.');
  }

  async getOrCreateStore(managerId: string) {
    let store = await this.prisma.store.findFirst({
      where: { managerId },
    });
    if (!store) {
      store = await this.prisma.store.create({
        data: {
          name: 'Cửa hàng PetMatching Quận 1',
          phone: '028.3822.4455',
          address: '120 Lê Lợi, Phường Bến Thành, Quận 1, TP. HCM',
          status: 'ACTIVE',
          managerId,
        },
      });
    }
    return store;
  }

  async getDashboardStats() {
    // Monthly revenue: Sum totalAmount of orders that are not CANCELLED
    const revenueSum = await this.prisma.order.aggregate({
      where: { status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    });
    const totalRevenue = revenueSum._sum.totalAmount ?? 0;

    // Total orders
    const totalOrders = await this.prisma.order.count();

    // Cancelled orders count
    const cancelledOrders = await this.prisma.order.count({
      where: { status: 'CANCELLED' },
    });

    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    // Total products sold: sum order item quantities where order status is not CANCELLED
    const itemsSold = await this.prisma.orderItem.aggregate({
      where: { order: { status: { not: 'CANCELLED' } } },
      _sum: { quantity: true },
    });
    const totalProductsSold = itemsSold._sum.quantity ?? 0;

    // Total customers
    const totalCustomers = await this.prisma.user.count({
      where: { role: 'USER' },
    });

    return {
      totalRevenue,
      totalOrders,
      totalProductsSold,
      totalCustomers,
      cancellationRate,
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

  async createProduct(dto: any) {
    const slug = this.generateSlug(dto.name);
    const id = await this.generateProductId();
    return this.prisma.product.create({
      data: {
        id,
        name: dto.name,
        slug,
        category: dto.category,
        targetSpecies: dto.targetSpecies || 'ALL',
        description: dto.description || '',
        imageUrl: dto.imageUrl || '',
        images: dto.images || [],
        specifications: dto.specifications || {},
        originalPrice: Number(dto.originalPrice),
        salePrice: dto.salePrice ? Number(dto.salePrice) : null,
        brand: dto.brand || '',
        unit: dto.unit || '',
        stock: (dto.stock !== undefined && dto.stock !== null && dto.stock !== '') ? Number(dto.stock) : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : false,
      },
    });
  }

  async updateProduct(id: string, dto: any) {
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        targetSpecies: dto.targetSpecies,
        description: dto.description,
        imageUrl: dto.imageUrl,
        images: dto.images,
        specifications: dto.specifications,
        originalPrice: dto.originalPrice !== undefined ? Number(dto.originalPrice) : undefined,
        salePrice: dto.salePrice !== undefined ? (dto.salePrice ? Number(dto.salePrice) : null) : undefined,
        brand: dto.brand,
        unit: dto.unit,
        stock: dto.stock !== undefined ? ((dto.stock !== null && dto.stock !== '') ? Number(dto.stock) : undefined) : undefined,
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
      },
    });
  }

  async deleteProduct(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }

  async getOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
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
          },
        },
      },
    });
  }

  async updateOrderStatus(id: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng.');
      }

      // If transition to CANCELLED from a non-CANCELLED state
      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
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
      }
      // If transition FROM CANCELLED to something else (e.g. processing)
      else if (order.status === 'CANCELLED' && status !== 'CANCELLED') {
        for (const item of order.items) {
          // Check stock before decrementing
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && product.stock < item.quantity) {
            throw new BadRequestException(
              `Không thể đổi trạng thái đơn hàng. Sản phẩm "${product.name}" hiện không đủ hàng trong kho (chỉ còn ${product.stock} cái).`
            );
          }

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

      return tx.order.update({
        where: { id },
        data: { status: status as any },
      });
    });
  }

  async getCustomers() {
    const users = await this.prisma.user.findMany({
      where: { role: 'USER' },
      include: {
        orders: {
          select: { totalAmount: true, status: true },
        },
      },
    });

    return users.map((u) => {
      const completedOrders = u.orders.filter((o) => o.status !== 'CANCELLED');
      const cancelledOrders = u.orders.filter((o) => o.status === 'CANCELLED');

      const totalOrders = completedOrders.length;
      const totalCancelled = cancelledOrders.length;
      const spent = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || 'N/A',
        totalOrders,
        totalCancelled,
        spent,
      };
    });
  }

  async updateStoreSettings(managerId: string, dto: any) {
    const store = await this.getOrCreateStore(managerId);
    return this.prisma.store.update({
      where: { id: store.id },
      data: {
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        description: dto.description || '',
      },
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
}

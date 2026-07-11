import { Injectable } from '@nestjs/common';
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
    return this.prisma.product.create({
      data: {
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
        stock: dto.stock ? Number(dto.stock) : null,
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
        stock: dto.stock !== undefined ? (dto.stock ? Number(dto.stock) : null) : undefined,
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
    return this.prisma.order.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async getCustomers() {
    const users = await this.prisma.user.findMany({
      where: { role: 'USER' },
      include: {
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: { totalAmount: true },
        },
      },
    });

    return users.map((u) => {
      const totalOrders = u.orders.length;
      const spent = u.orders.reduce((sum, o) => sum + o.totalAmount, 0);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || 'N/A',
        totalOrders,
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
}

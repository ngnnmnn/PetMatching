import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import { PaymentService } from '../payment/payment.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';

@Injectable()
export class ManagerService {
  constructor(
    private prisma: PrismaService,
    private shippingService: ShippingService,
    private paymentService: PaymentService,
    private cloudinaryService: CloudinaryService,
  ) {}

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

    // Calculate total profit
    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: { status: { not: 'CANCELLED' } } },
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
      const importPrice = item.product?.importPrice ?? (soldPrice * 0.5);
      totalProfit += (soldPrice - importPrice) * item.quantity;
    }

    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

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

  private validateProductPrices(sellingPrice: number, importPrice?: number | null, salePrice?: number | null, stock?: number) {
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      throw new BadRequestException('Giá bán phải là số lớn hơn 0.');
    }
    if (importPrice !== undefined && importPrice !== null && (isNaN(importPrice) || importPrice <= 0)) {
      throw new BadRequestException('Giá nhập phải là số lớn hơn 0.');
    }
    if (salePrice !== undefined && salePrice !== null && (isNaN(salePrice) || salePrice <= 0)) {
      throw new BadRequestException('Giá khuyến mãi phải là số lớn hơn 0.');
    }
    if (importPrice !== undefined && importPrice !== null && importPrice > sellingPrice) {
      throw new BadRequestException('Giá nhập không được lớn hơn giá bán.');
    }
    if (salePrice !== undefined && salePrice !== null && salePrice > sellingPrice) {
      throw new BadRequestException('Giá khuyến mãi không được lớn hơn giá bán.');
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
    const stock = (dto.stock !== undefined && dto.stock !== null && dto.stock !== '') ? Number(dto.stock) : 0;

    this.validateProductPrices(sellingPrice, importPrice, salePrice, stock);

    return this.prisma.product.create({
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
        stock,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : false,
      },
    });
  }

  async updateProduct(id: string, dto: any) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { sellingPrice: true, importPrice: true, salePrice: true, stock: true },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy sản phẩm.');
    }

    const sellingPrice = dto.sellingPrice !== undefined ? Number(dto.sellingPrice) : existing.sellingPrice;
    const importPrice = dto.importPrice !== undefined ? (dto.importPrice ? Number(dto.importPrice) : null) : existing.importPrice;
    const salePrice = dto.salePrice !== undefined ? (dto.salePrice ? Number(dto.salePrice) : null) : existing.salePrice;
    const stock = dto.stock !== undefined ? (dto.stock !== null && dto.stock !== '' ? Number(dto.stock) : existing.stock) : existing.stock;

    this.validateProductPrices(sellingPrice, importPrice, salePrice, stock);

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
        sellingPrice,
        importPrice,
        salePrice,
        brand: dto.brand,
        unit: dto.unit,
        stock,
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
    const orders = await this.prisma.order.findMany({
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

    return orders.filter(
      (o) => !(o.status === 'PENDING' && o.paymentMethod === 'QR'),
    );
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

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: status as any },
      });

      return updatedOrder;
    });

    // Auto-create GHN order if status is set to SHIPPED and has GHN districtId/wardCode
    if (status === 'SHIPPED') {
      const order = await this.prisma.order.findUnique({ where: { id } });
      if (order?.districtId && order?.wardCode && !order?.ghnOrderCode) {
        try {
          await this.shippingService.createShippingOrder(id);
        } catch (err) {
          console.error('Failed to auto-create GHN shipping order:', err);
        }
      }
    }

    return this.prisma.order.findUnique({ where: { id } });
  }

  async getCustomers() {
    const users = await this.prisma.user.findMany({
      where: { role: 'USER' },
      include: {
        orders: {
          include: {
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
      const completedOrders = u.orders.filter((o) => o.status !== 'CANCELLED');
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
      throw new BadRequestException('Danh mục với tên hoặc slug này đã tồn tại.');
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
      throw new BadRequestException('Không thể xóa danh mục này vì đang có sản phẩm thuộc danh mục.');
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
      throw new BadRequestException('Không thể xóa đơn vị tính này vì đang có sản phẩm sử dụng.');
    }

    return this.prisma.productUnit.delete({
      where: { id },
    });
  }

  async approveRefund(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    if (order.refundStatus !== 'PENDING' && order.refundStatus !== 'FAILED') {
      throw new BadRequestException('Đơn hàng không ở trạng thái chờ hoàn tiền hoặc hoàn tiền lỗi.');
    }

    if (!order.refundBankCode || !order.refundAccountNumber) {
      throw new BadRequestException('Thông tin tài khoản nhận tiền hoàn không đầy đủ.');
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

        return tx.order.update({
          where: { id: orderId },
          data: {
            status: 'CANCELLED',
            refundStatus: 'REFUNDED',
            refundedAt: new Date(),
          },
        });
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
      throw new BadRequestException('Đơn hàng không ở trạng thái chờ hoàn tiền hoặc hoàn tiền lỗi.');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'FAILED',
      },
    });
  }

  async importProducts(file: Express.Multer.File, imageFiles: Express.Multer.File[] = []) {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file tải lên.');
    }

    let workbook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch (e) {
      throw new BadRequestException('File không đúng định dạng Excel (.xlsx hoặc .xls).');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (rawRows.length === 0) {
      throw new BadRequestException('File Excel trống hoặc không chứa dữ liệu.');
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
      const row = rawRows[i];
      const rowNum = i + 2; // Dòng thứ i+2 trong Excel do có dòng tiêu đề

      const name = (row['Tên sản phẩm'] ?? row['name'] ?? '').toString().trim();
      const categoryStr = (row['Danh mục'] ?? row['category'] ?? '').toString().trim();
      const sellingPriceRaw = row['Giá bán'] ?? row['sellingPrice'];
      const importPriceRaw = row['Giá nhập'] ?? row['importPrice'];
      const quantityRaw = row['Số lượng nhập'] ?? row['quantity'] ?? row['stock'] ?? 0;
      const brand = (row['Thương hiệu'] ?? row['brand'] ?? '').toString().trim() || null;
      const unit = (row['Đơn vị tính'] ?? row['Đơn vị'] ?? row['unit'] ?? '').toString().trim() || null;
      const salePriceRaw = row['Giá khuyến mãi'] ?? row['salePrice'];
      const description = (row['Mô tả'] ?? row['description'] ?? '').toString().trim() || null;
      const targetSpecies = (row['Loài mục tiêu'] ?? row['targetSpecies'] ?? 'ALL').toString().trim().toUpperCase();
      const id = row['Mã sản phẩm'] ?? row['id'] ?? null;
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
      const salePrice = salePriceRaw !== undefined && salePriceRaw !== null && salePriceRaw !== '' ? Number(salePriceRaw) : null;

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
        errors.push(`Dòng ${rowNum}: Giá nhập (${importPrice}) không được lớn hơn giá bán (${sellingPrice}).`);
        continue;
      }

      const species = ['DOG', 'CAT', 'ALL'].includes(targetSpecies) ? targetSpecies : 'ALL';

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
          errors.push(`Dòng ${rowNum}: Cảnh báo: Lỗi định dạng thông số kỹ thuật (Cần dạng: Thuộc tính 1: Giá trị 1, Thuộc tính 2: Giá trị 2).`);
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

      let product = null;
      if (id) {
        product = await this.prisma.product.findUnique({
          where: { id: id.toString().trim() },
        });
      }

      const generatedSlug = this.generateSlug(name);
      if (!product) {
        product = await this.prisma.product.findFirst({
          where: {
            OR: [
              { slug: generatedSlug },
              { name: name }
            ]
          }
        });
      }

      // Match images for this product (filename starts with product ID or name slug)
      const cleanIdForImage = id ? id.toString().trim() : '';
      const matchedImages = imageFiles.filter((img) => {
        const originalName = img.originalname.toLowerCase();
        const cleanId = cleanIdForImage.toLowerCase();
        const cleanSlug = generatedSlug.toLowerCase();
        return (cleanId && originalName.startsWith(`${cleanId}_`)) || originalName.startsWith(`${cleanSlug}_`);
      });

      const imageUrls: string[] = [];
      for (const img of matchedImages) {
        try {
          const uploadRes = await this.cloudinaryService.uploadBuffer(img.buffer, 'products');
          imageUrls.push(uploadRes.url);
        } catch (err) {
          errors.push(`Dòng ${rowNum}: Cảnh báo: Lỗi khi tải ảnh ${img.originalname} lên Cloudinary: ${err.message || err}`);
        }
      }

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
        const newId = id ? id.toString().trim() : await this.generateProductId();
        await this.prisma.product.create({
          data: {
            id: newId,
            storeId: store.id,
            name,
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
        createdCount++;
      }
    }

    return {
      success: true,
      updatedCount,
      createdCount,
      errors,
    };
  }

  async exportOrdersToExcel(filters: { startDate?: string; endDate?: string; onlyPendingGhn?: boolean; onlyRefunded?: boolean }) {
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

    if (filters.onlyPendingGhn) {
      where.ghnOrderCode = null;
      where.status = { notIn: ['CANCELLED', 'SHIPPED', 'DELIVERED'] };
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
      const bankRes = await fetch('https://api.vietqr.io/v2/banks').then((r) => r.json());
      if (bankRes && bankRes.code === '00' && Array.isArray(bankRes.data)) {
        for (const b of bankRes.data) {
          bankMap.set(b.bin, `${b.shortName} - ${b.name}`);
        }
      }
    } catch (e) {
      console.error('Failed to fetch bank list for Excel export mapping', e);
    }

    const exportData = orders.map((o) => {
      let name = o.user?.name || '';
      let phone = o.user?.phone || '';
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

      const itemsList = o.items.map((i) => `${i.product?.name || 'Sản phẩm'} (x${i.quantity})`).join(', ');
      
      let orderProfit = 0;
      for (const i of o.items) {
        const soldPrice = i.price;
        const importPrice = i.product?.importPrice ?? (soldPrice * 0.5);
        orderProfit += (soldPrice - importPrice) * i.quantity;
      }

      const statusLabels: Record<string, string> = {
        PENDING: 'Đang xử lý',
        CONFIRMED: 'Đã xác nhận',
        SHIPPED: 'Đang giao hàng',
        DELIVERED: 'Đã hoàn thành',
        CANCELLED: 'Đã hủy',
      };

      return {
        'Mã đơn hàng': o.id,
        'Khách hàng': name,
        'SĐT': phone,
        'Địa chỉ giao hàng': address,
        'Ngày đặt': new Date(o.createdAt).toLocaleDateString('vi-VN'),
        'Sản phẩm': itemsList,
        'Tổng thanh toán': o.totalAmount,
        'Lợi nhuận đơn': orderProfit,
        'Trạng thái': statusLabels[o.status] || o.status,
        'Mã vận đơn GHN': o.ghnOrderCode || 'Chưa gửi',
        'STK Nhận hoàn tiền': o.refundAccountNumber || '',
        'Ngân hàng Nhận hoàn tiền': o.refundBankCode ? (bankMap.get(o.refundBankCode) || o.refundBankCode) : '',
        'Chủ tài khoản Nhận hoàn tiền': o.refundAccountName || '',
        'Ngày hoàn tiền': o.refundedAt ? new Date(o.refundedAt).toLocaleDateString('vi-VN') : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách đơn hàng');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}

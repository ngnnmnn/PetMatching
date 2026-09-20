import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ManagerService } from './manager.service';

const createService = (prisma: object) =>
  new ManagerService(
    prisma as unknown as PrismaService,
    {} as CloudinaryService,
    {} as NotificationsService,
  );
const configuredStore = () => ({
  findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }),
});
const now = new Date('2026-09-20T00:00:00.000Z');

describe('ManagerService dashboard revenue', () => {
  it('scopes dashboard metrics to the configured store', async () => {
    // Mô phỏng đầy đủ các truy vấn preview nhẹ của dashboard sau tối ưu.
    const prisma = {
      store: configuredStore(),
      order: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { totalAmount: 464_500 } }),
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PENDING', _count: { _all: 1 } },
          { status: 'CANCELLED', _count: { _all: 1 } },
        ]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderItem: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 3 } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      category: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = createService(prisma);

    const result = await service.getDashboardStats();

    expect(result.totalRevenue).toBe(464_500);
    expect(prisma.store.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    expect(prisma.order.aggregate).toHaveBeenCalledTimes(1);
    expect(prisma.order.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { storeId: 'store-1' },
      _count: { _all: true },
    });
    expect(result.totalOrders).toBe(2);
    expect(result.statusDistribution.CANCELLED).toBe(1);
  });

  it('rejects dashboard access when no store is configured', async () => {
    const prisma = {
      store: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = createService(prisma);

    await expect(service.getDashboardStats()).rejects.toThrow(
      'Cửa hàng chưa được cấu hình.',
    );
  });
});

describe('ManagerService completed order history', () => {
  it('uses the customer snapshot after the account relation is removed', async () => {
    const prisma = {
      store: configuredStore(),
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'PM-ORDER-1',
            userId: null,
            user: null,
            customerNameSnapshot: 'Nguyễn Văn A',
            customerEmailSnapshot: 'customer@example.com',
            customerPhoneSnapshot: '0900000000',
            payment: { method: 'COD', status: 'PAID' },
            items: [],
          },
        ]),
      },
    };
    const service = createService(prisma);

    const [order] = await service.getOrders();

    expect(order.user).toEqual({
      id: null,
      name: 'Nguyễn Văn A',
      email: 'customer@example.com',
      phone: '0900000000',
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store-1' } }),
    );
  });
});

describe('ManagerService product ownership', () => {
  it('assigns a new product to the configured store', async () => {
    const prisma = {
      store: configuredStore(),
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: '123456' }),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma);

    await service.createProduct({
      name: 'Thức ăn cho chó',
      category: 'DOG_FOOD',
      sellingPrice: 120_000,
      stock: 10,
      variants: [
        {
          name: 'Gói tiêu chuẩn',
          importPrice: 100_000,
          sellingPrice: 120_000,
          stock: 10,
        },
      ],
    });

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: 'store-1',
        name: 'Thức ăn cho chó',
      }),
    });
  });
});

describe('ManagerService store payloads', () => {
  it('returns a lightweight activity snapshot scoped to the configured store', async () => {
    // Mô phỏng các aggregate phiên bản thay cho việc tải toàn bộ bảng để tạo hash.
    const prisma = {
      store: configuredStore(),
      order: {
        findMany: jest.fn().mockResolvedValue([{ id: 'order-visible' }]),
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 1 },
          _max: { updatedAt: now },
        }),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 1 },
          _max: { updatedAt: now },
        }),
      },
      product: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 2 },
          _max: { updatedAt: now },
        }),
      },
      productVariant: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 1 },
          _max: { updatedAt: now },
        }),
      },
    };
    const service = createService(prisma);

    const result = await service.getActivitySnapshot();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storeId: 'store-1' }),
      }),
    );
    expect(result.orderIds).toEqual(['order-visible']);
    expect(result.ordersVersion).toContain(':');
    expect(result.inventoryVersion).toContain(':');
  });

  it('returns product counts without exposing review or order-item collections', async () => {
    const prisma = {
      store: configuredStore(),
      product: {
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'product-1',
            name: 'Thức ăn cho mèo',
            isActive: true,
            variants: [
              {
                id: 'variant-1',
                name: 'Gói 1kg',
                isActive: false,
              },
            ],
            _count: { reviews: 4 },
          },
        ]),
      },
      orderItem: {
        groupBy: jest.fn().mockResolvedValue([
          {
            productId: 'product-1',
            variantId: 'variant-1',
            _sum: { quantity: 3 },
          },
        ]),
      },
    };
    const service = createService(prisma);

    const [product] = await service.getProducts();

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          variants: true,
          _count: { select: { reviews: true } },
        }),
      }),
    );
    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith({
      by: ['productId', 'variantId'],
      where: {
        productId: { in: ['product-1'] },
        order: { status: { not: 'CANCELLED' } },
      },
      _sum: { quantity: true },
    });
    expect(product).toEqual(
      expect.objectContaining({
        id: 'product-1',
        isActive: false,
        sales: 3,
        reviewCount: 4,
        variants: [expect.objectContaining({ id: 'variant-1', sales: 3 })],
      }),
    );
    expect(product).not.toHaveProperty('orderItems');
    expect(product).not.toHaveProperty('_count');
    expect(product.variants[0]).not.toHaveProperty('orderItems');
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('selects only customer fields required by the manager screen', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            name: 'Nguyễn Văn A',
            phone: '0900001234',
            orders: [
              {
                id: 'order-1',
                status: 'DELIVERED',
                totalAmount: 120_000,
                createdAt: now,
                payment: { status: 'PAID' },
                items: [
                  {
                    id: 'item-1',
                    quantity: 1,
                    price: 120_000,
                    product: { name: 'Thức ăn cho mèo' },
                  },
                ],
              },
            ],
          },
        ]),
      },
    };
    const service = createService(prisma);

    const [customer] = await service.getCustomers();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          name: true,
          phone: true,
          orders: expect.objectContaining({
            select: expect.objectContaining({
              payment: { select: { status: true } },
              items: {
                select: expect.objectContaining({
                  product: { select: { name: true } },
                }),
              },
            }),
          }),
        }),
      }),
    );
    expect(customer).toEqual(
      expect.objectContaining({
        id: 'user-1',
        phone: '******1234',
        totalOrders: 1,
        spent: 120_000,
      }),
    );
  });
});

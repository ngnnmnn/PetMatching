import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ManagerService } from './manager.service';

describe('ManagerService dashboard revenue', () => {
  it('scopes dashboard metrics to the configured store', async () => {
    const prisma = {
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }),
      },
      order: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { totalAmount: 464_500 } }),
        count: jest.fn().mockResolvedValue(2),
      },
      orderItem: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 3 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        count: jest.fn().mockResolvedValue(10),
      },
    };
    const service = new ManagerService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
      {} as NotificationsService,
    );

    const result = await service.getDashboardStats();

    expect(result.totalRevenue).toBe(464_500);
    expect(prisma.store.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    expect(prisma.order.aggregate).toHaveBeenCalledTimes(1);
    expect(prisma.order.count).toHaveBeenNthCalledWith(1, {
      where: { storeId: 'store-1' },
    });
    expect(prisma.order.count).toHaveBeenNthCalledWith(2, {
      where: { storeId: 'store-1', status: 'CANCELLED' },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { role: 'USER' },
    });
  });

  it('rejects dashboard access when no store is configured', async () => {
    const prisma = {
      store: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new ManagerService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
      {} as NotificationsService,
    );

    await expect(service.getDashboardStats()).rejects.toThrow(
      'Cửa hàng chưa được cấu hình.',
    );
  });
});

describe('ManagerService completed order history', () => {
  it('uses the customer snapshot after the account relation is removed', async () => {
    const prisma = {
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }),
      },
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
    const service = new ManagerService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
      {} as NotificationsService,
    );

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
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: '123456' }),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new ManagerService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
      {} as NotificationsService,
    );

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

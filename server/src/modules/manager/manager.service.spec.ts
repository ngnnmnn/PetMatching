import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ManagerService } from './manager.service';

describe('ManagerService dashboard revenue', () => {
  it('uses the managed store delivered revenue instead of global paid payments', async () => {
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
      {} as any,
    );

    const result = await service.getDashboardStats('manager-1');

    expect(result.totalRevenue).toBe(464_500);
    expect(prisma.store.findFirst).toHaveBeenCalledWith({
      where: { managerId: 'manager-1' },
      select: { id: true },
    });
    expect(prisma.order.aggregate).toHaveBeenCalledTimes(1);
  });
});

describe('ManagerService store settings', () => {
  it('stores a canonical Hanoi ward selected by its official code', async () => {
    const prisma = {
      store: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'store-1',
          name: 'PetMatching',
          phone: '0987654321',
          address: 'Địa chỉ cũ',
          description: null,
        }),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'store-1',
          ...data,
        })),
      },
    };
    const service = new ManagerService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
      {} as any,
    );

    const result = await service.updateStoreSettings('manager-1', {
      name: 'PetMatching Hà Nội',
      phone: '0987654321',
      addressDetail: 'Số 1 Tràng Tiền',
      wardCode: '70',
      description: 'Cửa hàng thú cưng',
    });

    expect(prisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          address: 'Số 1 Tràng Tiền, Phường Hoàn Kiếm, Thành phố Hà Nội',
        }),
      }),
    );
    expect(result).toMatchObject({
      wardCode: '70',
      wardName: 'Phường Hoàn Kiếm',
      addressDetail: 'Số 1 Tràng Tiền',
    });
  });
});

describe('ManagerService completed order history', () => {
  it('uses the customer snapshot after the account relation is removed', async () => {
    const prisma = {
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
      {} as any,
    );

    const [order] = await service.getOrders();

    expect(order.user).toEqual({
      id: null,
      name: 'Nguyễn Văn A',
      email: 'customer@example.com',
      phone: '0900000000',
    });
  });
});

import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
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
      {} as ShippingService,
      {} as CloudinaryService,
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

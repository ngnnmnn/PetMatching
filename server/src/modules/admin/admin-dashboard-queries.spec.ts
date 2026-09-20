import { OrderStatus, SpaBookingStatus } from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminService } from './admin.service';
import { AdminSpaServicesService } from './spa-services/admin-spa-services.service';

function createAdminService(prisma: object) {
  return new AdminService(
    prisma as PrismaService,
    {} as NotificationsService,
    {} as CloudinaryService,
  );
}

describe('Admin dashboard optimized queries', () => {
  it('builds store status totals from one grouped query', async () => {
    const order = {
      count: jest.fn().mockResolvedValue(2),
      groupBy: jest.fn().mockResolvedValue([
        { status: OrderStatus.PENDING, _count: { _all: 3 } },
        { status: OrderStatus.CONFIRMED, _count: { _all: 4 } },
        { status: OrderStatus.SHIPPED, _count: { _all: 2 } },
        { status: OrderStatus.DELIVERED, _count: { _all: 5 } },
        { status: OrderStatus.CANCELLED, _count: { _all: 1 } },
      ]),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }),
    };
    const prisma = {
      store: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'store-1',
          name: 'PetMatching Store',
          address: 'HCMC',
          status: 'ACTIVE',
        }),
      },
      product: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
      },
      order,
      orderItem: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    const result = await createAdminService(prisma).getStoreDashboard({
      range: '7d',
    });

    expect(order.groupBy).toHaveBeenCalledTimes(1);
    expect(order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['status'] }),
    );
    expect(result.stats).toEqual(
      expect.objectContaining({
        totalOrders: 15,
        pendingOrders: 3,
        processingOrders: 6,
      }),
    );
    expect(result.statusDistribution).toEqual([
      { status: OrderStatus.PENDING, value: 3 },
      { status: OrderStatus.PROCESSING, value: 6 },
      { status: OrderStatus.DELIVERED, value: 5 },
      { status: OrderStatus.CANCELLED, value: 1 },
    ]);
  });

  it('groups Spa counters and aggregates all-time revenue in the database', async () => {
    const spaBooking = {
      count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(3),
      groupBy: jest
        .fn()
        .mockResolvedValueOnce([
          { status: SpaBookingStatus.PENDING, _count: { _all: 2 } },
          { status: SpaBookingStatus.CHECK_IN, _count: { _all: 1 } },
          { status: SpaBookingStatus.IN_PROGRESS, _count: { _all: 2 } },
          { status: SpaBookingStatus.COMPLETED, _count: { _all: 7 } },
          { status: SpaBookingStatus.NO_SHOW, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({ _sum: { totalPrice: 900 } })
        .mockResolvedValueOnce({ _sum: { priceSnapshot: 100 } }),
    };
    const prisma = {
      store: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'spa-1',
          name: 'PetMatching Spa',
          address: 'HCMC',
          status: 'ACTIVE',
          manager: null,
        }),
      },
      spaService: {
        groupBy: jest.fn().mockResolvedValue([
          { isActive: true, _count: { _all: 4 } },
          { isActive: false, _count: { _all: 1 } },
        ]),
        findMany: jest.fn(),
      },
      spaStaff: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'ACTIVE', _count: { _all: 3 } },
          { status: 'INACTIVE', _count: { _all: 1 } },
        ]),
      },
      spaBooking,
    };

    const result = await createAdminService(prisma).getSpaDashboard({
      range: '7d',
    });

    expect(spaBooking.groupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ by: ['status'] }),
    );
    expect(spaBooking.aggregate).toHaveBeenCalledTimes(2);
    expect(result.stats).toEqual(
      expect.objectContaining({
        services: 4,
        inactiveServices: 1,
        staffCount: 4,
        activeStaffCount: 3,
        totalBookings: 13,
        pendingBookings: 2,
        inProgressBookings: 3,
        completedBookings: 3,
        allTimeCompletedBookings: 7,
        allTimeRevenue: 1000,
      }),
    );
  });

  it('counts main and add-on Spa services without loading every booking', async () => {
    const spaBooking = {
      groupBy: jest
        .fn()
        .mockResolvedValue([{ serviceId: 'main-1', _count: { _all: 4 } }]),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { subServiceIds: ['extra-1', 'extra-2'] },
          { subServiceIds: ['extra-1'] },
        ]),
    };
    const service = new AdminSpaServicesService({
      spaService: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'main-1' },
            { id: 'extra-1' },
            { id: 'extra-2' },
          ]),
      },
      spaBooking,
    } as unknown as PrismaService);

    const result = await service.getServices();

    expect(spaBooking.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['serviceId'] }),
    );
    expect(spaBooking.findMany).toHaveBeenCalledWith({
      where: { subServiceIds: { isEmpty: false } },
      select: { subServiceIds: true },
    });
    expect(result).toEqual([
      { id: 'main-1', _count: { bookings: 4 } },
      { id: 'extra-1', _count: { bookings: 2 } },
      { id: 'extra-2', _count: { bookings: 1 } },
    ]);
  });
});

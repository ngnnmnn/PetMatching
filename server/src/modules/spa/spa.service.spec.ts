import { PaymentStatus, SpaBookingStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { SpaService } from './spa.service';

describe('SpaService manager dashboard revenue', () => {
  it('uses completed non-refunded bookings in the manager branches', async () => {
    const bookings = [
      {
        id: 'completed-unpaid',
        status: SpaBookingStatus.COMPLETED,
        payment: { status: PaymentStatus.PENDING },
        totalPrice: 100_000,
        priceSnapshot: 80_000,
        scheduledAt: new Date('2026-08-01T08:00:00Z'),
        serviceId: null,
        mainServiceId: null,
        subServiceIds: [],
        categoryId: 'category-1',
        feedback: null,
      },
      {
        id: 'completed-legacy',
        status: SpaBookingStatus.COMPLETED,
        payment: { status: PaymentStatus.PAID },
        totalPrice: 0,
        priceSnapshot: 50_000,
        scheduledAt: new Date('2026-08-01T09:00:00Z'),
        serviceId: null,
        mainServiceId: null,
        subServiceIds: [],
        categoryId: 'category-1',
        feedback: null,
      },
      {
        id: 'refunded',
        status: SpaBookingStatus.COMPLETED,
        payment: { status: PaymentStatus.REFUNDED },
        totalPrice: 200_000,
        priceSnapshot: 200_000,
        scheduledAt: new Date('2026-08-01T10:00:00Z'),
        serviceId: null,
        mainServiceId: null,
        subServiceIds: [],
        categoryId: 'category-1',
        feedback: null,
      },
      {
        id: 'paid-in-progress',
        status: SpaBookingStatus.IN_PROGRESS,
        payment: { status: PaymentStatus.PAID },
        totalPrice: 300_000,
        priceSnapshot: 300_000,
        scheduledAt: new Date('2026-08-01T11:00:00Z'),
        serviceId: null,
        mainServiceId: null,
        subServiceIds: [],
        categoryId: 'category-1',
        feedback: null,
      },
    ];
    const prisma = {
      addressSpa: {
        findMany: jest.fn().mockResolvedValue([{ id: 'spa-1' }]),
      },
      spaStaff: {
        count: jest.fn().mockResolvedValue(2),
      },
      spaBooking: {
        findMany: jest.fn().mockResolvedValue(bookings),
      },
      spaService: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      spaCategory: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'category-1', name: 'Dịch vụ', isMain: true },
          ]),
      },
    };
    const service = new SpaService(
      prisma as unknown as PrismaService,
      {} as PaymentService,
    );
    Object.defineProperty(service, 'autoUpdateBookingStatuses', {
      value: jest.fn(),
    });

    const result = await service.getManagerDashboardStats('manager-1', 'ALL');

    expect(result.totalRevenue).toBe(150_000);
    expect(prisma.spaBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { addressSpaId: { in: ['spa-1'] } },
      }),
    );
  });
});

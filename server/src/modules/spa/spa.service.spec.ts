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
      {} as any,
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

  describe('SpaService getAvailability and slot deduction', () => {
    it('deducts available staff slots for both assigned and unassigned active bookings, and restores on cancel', async () => {
      const staffs = [
        {
          id: 'staff-rec-1',
          userId: 'user-staff-1',
          addressSpaId: 'branch-1',
          status: 'ACTIVE',
          user: { id: 'user-staff-1', name: 'Nhân viên 1', email: 'staff1@spa.local', avatarUrl: null },
        },
        {
          id: 'staff-rec-2',
          userId: 'user-staff-2',
          addressSpaId: 'branch-1',
          status: 'ACTIVE',
          user: { id: 'user-staff-2', name: 'Nhân viên 2', email: 'staff2@spa.local', avatarUrl: null },
        },
      ];

      // Booking 1: Assigned to staff 1 at 10:00 (10:00 - 10:45)
      // Booking 2: Unassigned (PENDING, staffId: null) at 10:00 (10:00 - 10:30)
      const activeBookings = [
        {
          id: 'b-1',
          addressSpaId: 'branch-1',
          staffId: 'user-staff-1',
          status: SpaBookingStatus.ASSIGNED,
          scheduledAt: new Date('2026-08-20T10:00:00'),
          timeStartExpected: new Date('2026-08-20T10:00:00'),
          timeEndExpected: new Date('2026-08-20T10:45:00'),
          service: { durationMin: 45, durationMax: 45 },
        },
        {
          id: 'b-2',
          addressSpaId: 'branch-1',
          staffId: null,
          status: SpaBookingStatus.PENDING,
          scheduledAt: new Date('2026-08-20T10:00:00'),
          timeStartExpected: new Date('2026-08-20T10:00:00'),
          timeEndExpected: new Date('2026-08-20T10:30:00'),
          service: { durationMin: 30, durationMax: 30 },
        },
      ];

      const prisma = {
        spaStaff: {
          findMany: jest.fn().mockResolvedValue(staffs),
        },
        spaBooking: {
          findMany: jest.fn().mockResolvedValue(activeBookings),
        },
      };

      const service = new SpaService(
        prisma as unknown as PrismaService,
        {} as PaymentService,
        {} as any,
      );
      Object.defineProperty(service, 'autoUpdateBookingStatuses', {
        value: jest.fn(),
      });

      const slots = await service.getAvailability('branch-1', '2026-08-20', 30);
      const slot1000 = slots.find((s) => s.time === '10:00');
      const slot1100 = slots.find((s) => s.time === '11:00');

      // At 10:00: 2 active staff total. 1 assigned to b-1 (staff 1 busy), 1 free staff (staff 2).
      // 1 unassigned booking (b-2) consumes 1 slot -> remainingSlots = max(0, 1 - 1) = 0.
      expect(slot1000).toBeDefined();
      expect(slot1000?.remainingSlots).toBe(0);
      expect(slot1000?.isAvailable).toBe(false);
      expect(slot1000?.availableStaffs).toHaveLength(0);

      // At 11:00: both bookings ended -> 2 staff available
      expect(slot1100).toBeDefined();
      expect(slot1100?.remainingSlots).toBe(2);
      expect(slot1100?.isAvailable).toBe(true);
      expect(slot1100?.availableStaffs).toHaveLength(2);
    });

    it('restores slot when unassigned booking is cancelled', async () => {
      const staffs = [
        {
          id: 'staff-rec-1',
          userId: 'user-staff-1',
          addressSpaId: 'branch-1',
          status: 'ACTIVE',
          user: { id: 'user-staff-1', name: 'Nhân viên 1', email: 'staff1@spa.local', avatarUrl: null },
        },
        {
          id: 'staff-rec-2',
          userId: 'user-staff-2',
          addressSpaId: 'branch-1',
          status: 'ACTIVE',
          user: { id: 'user-staff-2', name: 'Nhân viên 2', email: 'staff2@spa.local', avatarUrl: null },
        },
      ];

      // Only 1 assigned booking, no unassigned booking (as if b-2 was cancelled)
      const activeBookings = [
        {
          id: 'b-1',
          addressSpaId: 'branch-1',
          staffId: 'user-staff-1',
          status: SpaBookingStatus.ASSIGNED,
          scheduledAt: new Date('2026-08-20T10:00:00'),
          timeStartExpected: new Date('2026-08-20T10:00:00'),
          timeEndExpected: new Date('2026-08-20T10:30:00'),
          service: { durationMin: 30, durationMax: 30 },
        },
      ];

      const prisma = {
        spaStaff: {
          findMany: jest.fn().mockResolvedValue(staffs),
        },
        spaBooking: {
          findMany: jest.fn().mockResolvedValue(activeBookings),
        },
      };

      const service = new SpaService(
        prisma as unknown as PrismaService,
        {} as PaymentService,
        {} as any,
      );
      Object.defineProperty(service, 'autoUpdateBookingStatuses', {
        value: jest.fn(),
      });

      const slots = await service.getAvailability('branch-1', '2026-08-20', 30);
      const slot1000 = slots.find((s) => s.time === '10:00');

      // At 10:00: staff 1 busy, staff 2 free -> 1 slot remaining
      expect(slot1000?.remainingSlots).toBe(1);
      expect(slot1000?.isAvailable).toBe(true);
      expect(slot1000?.availableStaffs).toHaveLength(1);
      expect(slot1000?.availableStaffs[0].id).toBe('user-staff-2');
    });

    it('rejects createBooking when all slots in the branch are occupied', async () => {
      const staffs = [
        {
          id: 'staff-rec-1',
          userId: 'user-staff-1',
          addressSpaId: 'branch-1',
          status: 'ACTIVE',
        },
      ];

      const activeBookings = [
        {
          id: 'b-1',
          addressSpaId: 'branch-1',
          staffId: 'user-staff-1',
          status: SpaBookingStatus.ASSIGNED,
          scheduledAt: new Date('2028-08-20T10:00:00'),
          timeStartExpected: new Date('2028-08-20T10:00:00'),
          timeEndExpected: new Date('2028-08-20T10:30:00'),
          service: { durationMin: 30, durationMax: 30 },
        },
      ];

      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        },
        addressSpa: {
          findUnique: jest.fn().mockResolvedValue({ id: 'branch-1' }),
        },
        spaService: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'service-1',
            price: 100_000,
            durationMin: 30,
            durationMax: 30,
            isActive: true,
          }),
        },
        spaStaff: {
          findMany: jest.fn().mockResolvedValue(staffs),
        },
        spaBooking: {
          findMany: jest.fn().mockResolvedValue(activeBookings),
        },
      };

      const service = new SpaService(
        prisma as unknown as PrismaService,
        {} as PaymentService,
        {} as any,
      );

      await expect(
        service.createBooking('user-1', {
          addressSpaId: 'branch-1',
          mainServiceId: 'service-1',
          scheduledAt: '2028-08-20T10:00:00',
        }),
      ).rejects.toThrow('Khung giờ này tại chi nhánh đã kín lịch');
    });
  });
});



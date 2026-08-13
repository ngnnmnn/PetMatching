import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { SpaReminderService } from './spa-reminder.service';

describe('SpaReminderService', () => {
  it('claims a due booking and creates one reminder in the same transaction', async () => {
    const booking = {
      id: 'booking-1',
      userId: 'user-1',
      petName: 'Milo',
      scheduledAt: new Date('2026-08-14T04:30:00Z'),
    };
    const tx = {
      spaBooking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      spaBooking: { findMany: jest.fn().mockResolvedValue([booking]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = { create: jest.fn().mockResolvedValue({}) };
    const service = new SpaReminderService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );

    await expect(
      service.sendDueReminders(new Date('2026-08-14T04:00:00Z')),
    ).resolves.toEqual({ sentCount: 1 });
    expect(tx.spaBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: booking.id, reminderSentAt: null },
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', entityId: booking.id }),
      tx,
    );
  });

  it('does not send when another worker already claimed the booking', async () => {
    const tx = {
      spaBooking: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      spaBooking: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'booking-1',
            userId: 'user-1',
            petName: null,
            scheduledAt: new Date(),
          },
        ]),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = { create: jest.fn() };
    const service = new SpaReminderService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );

    await expect(service.sendDueReminders()).resolves.toEqual({ sentCount: 0 });
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

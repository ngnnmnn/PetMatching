/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
import { NotificationCategory } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let notification: Record<string, jest.Mock>;
  let service: NotificationsService;

  beforeEach(() => {
    notification = {
      findMany: jest.fn().mockResolvedValue([{ id: 'notification-1' }]),
      count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'notification-1', isRead: true }),
      create: jest.fn(),
    };
    const prisma = {
      notification,
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it('lists only active notifications owned by the authenticated user', async () => {
    const result = await service.findAll('user-1', {
      category: NotificationCategory.ORDER,
      page: 2,
      limit: 10,
    });

    expect(notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          deletedAt: null,
          category: NotificationCategory.ORDER,
        },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(result.unreadCount).toBe(1);
  });

  it('marks only the user-owned active notification as read', async () => {
    notification.updateMany.mockResolvedValue({ count: 1 });
    await service.markAsRead('user-1', 'notification-1');

    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notification-1', userId: 'user-1', deletedAt: null },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it('rejects reading another user notification', async () => {
    notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.markAsRead('user-1', 'notification-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes instead of physically deleting', async () => {
    notification.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.remove('user-1', 'notification-1')).resolves.toEqual({
      deleted: true,
    });

    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notification-1', userId: 'user-1', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('marks every unread active notification of the user as read', async () => {
    notification.updateMany.mockResolvedValue({ count: 3 });
    await expect(service.markAllAsRead('user-1')).resolves.toEqual({
      updatedCount: 3,
    });
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', deletedAt: null, isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
});

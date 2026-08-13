import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationEventType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetNotificationsDto } from './dto/get-notifications.dto';

type NotificationDb = PrismaService | Prisma.TransactionClient;

export type CreateNotificationInput = {
  userId: string;
  category: NotificationCategory;
  eventType: NotificationEventType;
  title: string;
  content: string;
  targetUrl?: string;
  entityType?: string;
  entityId?: string;
  payload?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateNotificationInput, db: NotificationDb = this.prisma) {
    return db.notification.create({ data: input });
  }

  async findAll(userId: string, dto: GetNotificationsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const where: Prisma.NotificationWhereInput = {
      userId,
      deletedAt: null,
      ...(dto.category ? { category: dto.category } : {}),
    };

    const [data, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, deletedAt: null, isRead: false },
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      unreadCount,
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, deletedAt: null, isRead: false },
    });
    return { count };
  }

  async markAsRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, deletedAt: null },
      data: { isRead: true, readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy thông báo.');
    return this.prisma.notification.findUniqueOrThrow({ where: { id } });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, deletedAt: null, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy thông báo.');
    return { deleted: true };
  }
}

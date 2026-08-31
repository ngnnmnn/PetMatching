import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  NotificationCategory,
  NotificationEventType,
  SpaBookingStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const REMINDER_WINDOW_MS = 30 * 60 * 1000;
const SCAN_INTERVAL_MS = 60 * 1000;

@Injectable()
export class SpaReminderService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SpaReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    void this.sendDueReminders();
    this.timer = setInterval(
      () => void this.sendDueReminders(),
      SCAN_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sendDueReminders(now = new Date()) {
    if (this.running) return { sentCount: 0 };
    this.running = true;
    try {
      const reminderUntil = new Date(now.getTime() + REMINDER_WINDOW_MS);
      const bookings = await this.prisma.spaBooking.findMany({
        where: {
          userId: { not: null },
          reminderSentAt: null,
          scheduledAt: { gt: now, lte: reminderUntil },
          status: {
            in: [
              SpaBookingStatus.PENDING,
              SpaBookingStatus.CONFIRMED,
              SpaBookingStatus.ASSIGNED,
            ],
          },
        },
        select: {
          id: true,
          userId: true,
          petName: true,
          scheduledAt: true,
        },
      });

      let sentCount = 0;
      for (const booking of bookings) {
        if (!booking.userId) continue;
        const bookingUserId = booking.userId;
        await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.spaBooking.updateMany({
            where: { id: booking.id, reminderSentAt: null },
            data: { reminderSentAt: now },
          });
          if (!claimed.count) return;

          const time = new Intl.DateTimeFormat('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh',
          }).format(booking.scheduledAt);
          await this.notifications.create(
            {
              userId: bookingUserId,
              category: NotificationCategory.APPOINTMENT,
              eventType: NotificationEventType.SPA_BOOKING_REMINDER,
              title: 'Sắp đến lịch hẹn Spa',
              content: `Lịch Spa của ${booking.petName || 'thú cưng'} bắt đầu lúc ${time}.`,
              targetUrl: `/spa/bookings?bookingId=${booking.id}`,
              entityType: 'SPA_BOOKING',
              entityId: booking.id,
            },
            tx,
          );
          sentCount += 1;
        });
      }
      return { sentCount };
    } catch (error) {
      this.logger.error('Không thể gửi nhắc lịch Spa', error);
      return { sentCount: 0 };
    } finally {
      this.running = false;
    }
  }
}

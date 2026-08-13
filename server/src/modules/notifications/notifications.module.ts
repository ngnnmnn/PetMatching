import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SpaReminderService } from './spa-reminder.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SpaReminderService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

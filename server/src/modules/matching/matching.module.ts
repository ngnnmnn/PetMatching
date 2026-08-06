import { Module } from '@nestjs/common';
import { MailModule } from '../../common/mail/mail.module';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

@Module({
  imports: [MailModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}

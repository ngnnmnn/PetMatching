import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

import { OsrmService } from './osrm.service';

/**
 * Module quản lý các chức năng ghép đôi thú cưng và tính toán lộ trình khoảng cách OSRM
 */
@Module({
  controllers: [MatchingController],
  providers: [MatchingService, OsrmService],
  exports: [MatchingService, OsrmService],
})
export class MatchingModule {}

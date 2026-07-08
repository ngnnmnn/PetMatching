import { Module } from '@nestjs/common';
import { SpaController } from './spa.controller';
import { SpaService } from './spa.service';

@Module({
  controllers: [SpaController],
  providers: [SpaService],
})
export class SpaModule {}

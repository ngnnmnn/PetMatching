import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/vouchers')
@UseGuards(JwtAuthGuard)
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async applyVoucher(@Body() body: { code: string; totalAmount: number }) {
    return this.vouchersService.applyVoucher(body.code, body.totalAmount);
  }
}

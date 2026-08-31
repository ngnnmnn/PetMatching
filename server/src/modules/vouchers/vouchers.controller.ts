import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateVoucherDto, UpdateVoucherDto } from './dto/voucher.dto';

@Controller('api/vouchers')
@UseGuards(JwtAuthGuard)
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async applyVoucher(@Body() body: { code: string; totalAmount: number }) {
    return this.vouchersService.applyVoucher(body.code, body.totalAmount);
  }

  @Get()
  async getAllVouchers() {
    return this.vouchersService.getAllVouchers();
  }

  @Post()
  async createVoucher(@Body() dto: CreateVoucherDto) {
    return this.vouchersService.createVoucher(dto);
  }

  @Put(':id')
  async updateVoucher(
    @Param('id') id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.vouchersService.updateVoucher(id, dto);
  }

  @Patch(':id/toggle')
  async toggleVoucherStatus(@Param('id') id: string) {
    return this.vouchersService.toggleVoucherStatus(id);
  }

  @Delete(':id')
  async deleteVoucher(@Param('id') id: string) {
    return this.vouchersService.deleteVoucher(id);
  }
}

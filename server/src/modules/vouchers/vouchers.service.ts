import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async applyVoucher(code: string, totalAmount: number) {
    if (!code) {
      throw new BadRequestException('Mã giảm giá không được để trống.');
    }

    const voucher = await this.prisma.voucher.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!voucher) {
      throw new NotFoundException('Mã giảm giá không tồn tại.');
    }

    if (!voucher.isActive) {
      throw new BadRequestException('Mã giảm giá đã bị vô hiệu hóa.');
    }

    if (voucher.expiredAt && voucher.expiredAt < new Date()) {
      throw new BadRequestException('Mã giảm giá đã hết hạn sử dụng.');
    }

    if (voucher.maxUsage && voucher.usedCount >= voucher.maxUsage) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng.');
    }

    return {
      success: true,
      code: voucher.code,
      type: voucher.type,
      value: voucher.value,
      message:
        voucher.type === 'FREE_SHIP'
          ? 'Áp dụng mã miễn phí vận chuyển thành công!'
          : `Áp dụng mã giảm giá thành công!`,
    };
  }
}

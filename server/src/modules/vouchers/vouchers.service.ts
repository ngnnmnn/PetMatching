import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVoucherDto, UpdateVoucherDto } from './dto/voucher.dto';

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

    const now = new Date();
    if (voucher.expiredAt && new Date(voucher.expiredAt) <= now) {
      throw new BadRequestException('Mã giảm giá đã hết hạn sử dụng.');
    }

    if (voucher.maxUsage && voucher.usedCount >= voucher.maxUsage) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng.');
    }

    if (voucher.minOrderAmount && totalAmount < voucher.minOrderAmount) {
      throw new BadRequestException(
        `Đơn hàng tối thiểu để sử dụng mã này là ${voucher.minOrderAmount.toLocaleString('vi-VN')}đ.`,
      );
    }

    let discountAmount = 0;
    if (voucher.type === 'FREE_SHIP') {
      // FREE_SHIP applies to shipping fee on client, discountAmount for subtotal is 0
      discountAmount = 0;
    } else if (voucher.type === 'PERCENTAGE') {
      let calc = (totalAmount * voucher.value) / 100;
      if (voucher.maxDiscountAmount && calc > voucher.maxDiscountAmount) {
        calc = voucher.maxDiscountAmount;
      }
      discountAmount = Math.round(calc);
    } else if (voucher.type === 'FIXED') {
      discountAmount = Math.min(totalAmount, voucher.value);
    }

    return {
      success: true,
      code: voucher.code,
      type: voucher.type,
      value: voucher.value,
      discountAmount,
      message:
        voucher.type === 'FREE_SHIP'
          ? (voucher.value === 100 || voucher.value === 0 ? 'Áp dụng mã Miễn Phí Vận Chuyển 100% thành công!' : `Áp dụng mã giảm phí vận chuyển ${voucher.value.toLocaleString('vi-VN')}đ thành công!`)
          : `Áp dụng mã giảm giá thành công! Giảm ${discountAmount.toLocaleString('vi-VN')}đ`,
    };
  }

  async getAllVouchers() {
    return this.prisma.voucher.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createVoucher(dto: CreateVoucherDto) {
    const cleanCode = dto.code.trim().toUpperCase();
    if (!cleanCode) {
      throw new BadRequestException('Mã khuyến mãi không được để trống.');
    }

    const existing = await this.prisma.voucher.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      throw new ConflictException(`Mã khuyến mãi "${cleanCode}" đã tồn tại.`);
    }

    const val = Number(dto.value);
    if (isNaN(val) || val < 0) {
      throw new BadRequestException('Giá trị giảm không hợp lệ.');
    }
    if (dto.type === 'PERCENTAGE' && (val <= 0 || val > 100)) {
      throw new BadRequestException('Phần trăm giảm giá phải từ 1% đến 100%.');
    }
    if (dto.type === 'FIXED' && val <= 0) {
      throw new BadRequestException('Số tiền giảm phải lớn hơn 0đ.');
    }

    const expiredAt = dto.expiredAt ? new Date(dto.expiredAt) : null;
    const now = new Date();

    if (expiredAt) {
      if (isNaN(expiredAt.getTime())) {
        throw new BadRequestException('Ngày kết thúc không hợp lệ.');
      }
      if (expiredAt <= now) {
        throw new BadRequestException('Ngày kết thúc phải là một thời điểm trong tương lai (sau thời điểm hiện tại).');
      }
    }

    return this.prisma.voucher.create({
      data: {
        code: cleanCode,
        type: dto.type,
        value: val,
        minOrderAmount: dto.minOrderAmount ? Number(dto.minOrderAmount) : 0,
        maxDiscountAmount: dto.maxDiscountAmount ? Number(dto.maxDiscountAmount) : null,
        description: dto.description?.trim() || null,
        maxUsage: dto.maxUsage ? Number(dto.maxUsage) : null,
        expiredAt: expiredAt,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateVoucher(id: string, dto: UpdateVoucherDto) {
    const existing = await this.prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy khuyến mãi.');
    }

    let cleanCode = existing.code;
    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      cleanCode = dto.code.trim().toUpperCase();
      if (!cleanCode) {
        throw new BadRequestException('Mã khuyến mãi không được để trống.');
      }
      const codeCheck = await this.prisma.voucher.findUnique({
        where: { code: cleanCode },
      });
      if (codeCheck) {
        throw new ConflictException(`Mã khuyến mãi "${cleanCode}" đã tồn tại.`);
      }
    }

    const type = dto.type ?? existing.type;
    const val = dto.value !== undefined ? Number(dto.value) : existing.value;
    if (isNaN(val) || val < 0) {
      throw new BadRequestException('Giá trị giảm không hợp lệ.');
    }
    if (type === 'PERCENTAGE' && (val <= 0 || val > 100)) {
      throw new BadRequestException('Phần trăm giảm giá phải từ 1% đến 100%.');
    }
    if (type === 'FIXED' && val <= 0) {
      throw new BadRequestException('Số tiền giảm phải lớn hơn 0đ.');
    }

    const expiredAt = dto.expiredAt !== undefined
      ? (dto.expiredAt ? new Date(dto.expiredAt) : null)
      : existing.expiredAt;

    const now = new Date();
    if (expiredAt) {
      if (isNaN(expiredAt.getTime())) {
        throw new BadRequestException('Ngày kết thúc không hợp lệ.');
      }
      if (expiredAt <= now) {
        throw new BadRequestException('Ngày kết thúc phải là một thời điểm trong tương lai (sau thời điểm hiện tại).');
      }
    }

    return this.prisma.voucher.update({
      where: { id },
      data: {
        code: cleanCode,
        type: type,
        value: val,
        minOrderAmount:
          dto.minOrderAmount !== undefined
            ? Number(dto.minOrderAmount)
            : existing.minOrderAmount,
        maxDiscountAmount:
          dto.maxDiscountAmount !== undefined
            ? dto.maxDiscountAmount ? Number(dto.maxDiscountAmount) : null
            : existing.maxDiscountAmount,
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : existing.description,
        maxUsage:
          dto.maxUsage !== undefined
            ? dto.maxUsage ? Number(dto.maxUsage) : null
            : existing.maxUsage,
        expiredAt: expiredAt,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });
  }

  async toggleVoucherStatus(id: string) {
    const existing = await this.prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy khuyến mãi.');
    }

    return this.prisma.voucher.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  async deleteVoucher(id: string) {
    const existing = await this.prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy khuyến mãi.');
    }

    await this.prisma.voucher.delete({ where: { id } });
    return { success: true, message: 'Đã xóa khuyến mãi thành công.' };
  }
}

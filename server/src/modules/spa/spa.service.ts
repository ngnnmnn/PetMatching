import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ApprovalStatus, SpaBookingStatus } from '@prisma/client';

@Injectable()
export class SpaService {
  constructor(private readonly prisma: PrismaService) {}

  async getBranches() {
    return this.prisma.spaBranch.findMany({
      where: {
        status: ApprovalStatus.ACTIVE,
      },
      include: {
        services: {
          where: {
            isActive: true,
          },
        },
      },
    });
  }

  async getServices() {
    return this.prisma.spaService.findMany({
      where: {
        isActive: true,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
      },
    });
  }

  async createBooking(userId: string, dto: CreateBookingDto) {
    const branch = await this.prisma.spaBranch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch || branch.status !== ApprovalStatus.ACTIVE) {
      throw new NotFoundException('Chi nhánh Spa không tồn tại hoặc đã dừng hoạt động.');
    }

    const service = await this.prisma.spaService.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service || !service.isActive || service.branchId !== dto.branchId) {
      throw new NotFoundException('Dịch vụ Spa không tồn tại hoặc không thuộc chi nhánh này.');
    }

    const bookingTime = new Date(dto.scheduledAt);
    if (isNaN(bookingTime.getTime())) {
      throw new BadRequestException('Thời gian đặt lịch không hợp lệ.');
    }

    if (bookingTime.getTime() <= Date.now()) {
      throw new BadRequestException('Thời gian đặt lịch phải ở trong tương lai.');
    }

    return this.prisma.spaBooking.create({
      data: {
        userId,
        branchId: dto.branchId,
        serviceId: dto.serviceId,
        petName: dto.petName || 'Thú cưng',
        scheduledAt: bookingTime,
        status: SpaBookingStatus.PENDING,
        priceSnapshot: service.price,
        note: dto.note,
      },
      include: {
        branch: {
          select: { name: true, address: true },
        },
        service: {
          select: { name: true, price: true },
        },
      },
    });
  }

  async getMyBookings(userId: string) {
    return this.prisma.spaBooking.findMany({
      where: {
        userId,
      },
      include: {
        branch: {
          select: {
            name: true,
            address: true,
            phone: true,
          },
        },
        service: {
          select: {
            name: true,
            description: true,
          },
        },
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });
  }

  async cancelBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    if (booking.userId !== userId) {
      throw new BadRequestException('Bạn không có quyền hủy lịch hẹn này.');
    }

    if (
      booking.status === SpaBookingStatus.COMPLETED ||
      booking.status === SpaBookingStatus.CANCELLED ||
      booking.status === SpaBookingStatus.NO_SHOW
    ) {
      throw new BadRequestException('Không thể hủy lịch hẹn đã hoàn thành, đã hủy hoặc vắng mặt.');
    }

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        status: SpaBookingStatus.CANCELLED,
      },
    });
  }
}

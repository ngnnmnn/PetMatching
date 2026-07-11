import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ApprovalStatus, SpaBookingStatus, AccountStatus, UserRole } from '@prisma/client';

@Injectable()
export class SpaService {
  constructor(private readonly prisma: PrismaService) {}

  async getBranches() {
    return this.prisma.spaBrand.findMany({
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
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async createBooking(userId: string, dto: CreateBookingDto) {
    const service = await this.prisma.spaService.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Dịch vụ Spa không tồn tại hoặc đã dừng hoạt động.');
    }

    const brandId = dto.branchId || service.brandId;

    const bookingTime = new Date(dto.scheduledAt);
    if (isNaN(bookingTime.getTime())) {
      throw new BadRequestException('Thời gian đặt lịch không hợp lệ.');
    }

    if (bookingTime.getTime() <= Date.now()) {
      throw new BadRequestException('Thời gian đặt lịch phải ở trong tương lai.');
    }

    const bookingStatus = dto.staffId ? SpaBookingStatus.ASSIGNED : SpaBookingStatus.PENDING;

    return this.prisma.spaBooking.create({
      data: {
        userId,
        brandId,
        addressSpaId: dto.addressSpaId || null,
        serviceId: dto.serviceId,
        staffId: dto.staffId || null,
        petId: dto.petId || null,
        petName: dto.petName || 'Thú cưng',
        scheduledAt: bookingTime,
        status: bookingStatus,
        priceSnapshot: service.price,
        note: dto.note,
      },
      include: {
        brand: {
          select: { name: true },
        },
        addressSpa: {
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
        brand: {
          select: {
            name: true,
          },
        },
        addressSpa: {
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
        pet: true,
        staff: {
          select: {
            name: true,
            avatarUrl: true,
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

  async getStaffBookings(staffId: string) {
    return this.prisma.spaBooking.findMany({
      where: {
        staffId,
      },
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        addressSpa: {
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
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
            avatarUrl: true,
          },
        },
        pet: true,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });
  }

  async updateStaffBooking(
    staffId: string,
    bookingId: string,
    dto: {
      status?: SpaBookingStatus;
      petConditionAfter?: string;
      photoAfter?: string;
      issueReported?: string;
    },
  ) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    if (booking.staffId !== staffId) {
      throw new BadRequestException('Bạn không được phân công thực hiện lịch hẹn này.');
    }

    const updatedData: any = {};
    if (dto.status !== undefined) {
      updatedData.status = dto.status;
    }
    if (dto.petConditionAfter !== undefined) {
      updatedData.petConditionAfter = dto.petConditionAfter;
    }
    if (dto.photoAfter !== undefined) {
      updatedData.photoAfter = dto.photoAfter;
    }
    if (dto.issueReported !== undefined) {
      updatedData.issueReported = dto.issueReported;
    }

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: updatedData,
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        service: {
          select: {
            name: true,
            description: true,
          },
        },
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async getStaffList() {
    return this.prisma.user.findMany({
      where: {
        role: UserRole.SPA_STAFF,
        accountStatus: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        phone: true,
      },
    });
  }

  async getSpaAddresses() {
    return this.prisma.addressSpa.findMany({
      where: {
        status: ApprovalStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
      },
    });
  }

  async getStaffProfile(userId: string) {
    return this.prisma.spaStaff.findUnique({
      where: { userId },
      include: {
        addressSpa: {
          select: {
            name: true,
            address: true,
          },
        },
      },
    });
  }
}

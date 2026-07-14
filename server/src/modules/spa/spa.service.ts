import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
    await this.autoUpdateBookingStatuses();
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
    await this.autoUpdateBookingStatuses();
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

  // =============================================================
  // SPA MANAGER ENDPOINTS & LOGIC
  // =============================================================

  async autoUpdateBookingStatuses() {
    const now = new Date();

    // 1. ASSIGNED -> LATE if scheduledAt in past
    const lateBookings = await this.prisma.spaBooking.findMany({
      where: {
        status: SpaBookingStatus.ASSIGNED,
        scheduledAt: { lt: now },
      },
    });
    if (lateBookings.length > 0) {
      await this.prisma.spaBooking.updateMany({
        where: { id: { in: lateBookings.map((b) => b.id) } },
        data: { status: SpaBookingStatus.LATE },
      });
    }

    // 2. LATE -> NO_SHOW if 15 minutes past scheduledAt
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const noShowBookings = await this.prisma.spaBooking.findMany({
      where: {
        status: SpaBookingStatus.LATE,
        scheduledAt: { lt: fifteenMinsAgo },
      },
    });
    if (noShowBookings.length > 0) {
      await this.prisma.spaBooking.updateMany({
        where: { id: { in: noShowBookings.map((b) => b.id) } },
        data: { status: SpaBookingStatus.NO_SHOW },
      });
    }
  }

  async getManagerBranches(managerId: string) {
    return this.prisma.addressSpa.findMany({
      where: { managerId },
    });
  }

  async getManagerDashboardStats(managerId: string, branchId: string) {
    await this.autoUpdateBookingStatuses();

    // Verify manager manages this branch
    const branch = await this.prisma.addressSpa.findFirst({
      where: { id: branchId, managerId },
    });
    if (!branch) {
      throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
    }

    // Get total staff
    const staffCount = await this.prisma.spaStaff.count({
      where: { addressSpaId: branchId },
    });

    // Get bookings
    const bookings = await this.prisma.spaBooking.findMany({
      where: { addressSpaId: branchId },
      include: {
        service: true,
        user: true,
        pet: true,
        staff: true,
      },
    });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayBookings = bookings.filter((b) => {
      const d = new Date(b.scheduledAt);
      const isToday = d >= startOfDay && d <= endOfDay;
      const isPendingOrConfirmed = b.status === SpaBookingStatus.PENDING || b.status === SpaBookingStatus.CONFIRMED;
      return isToday || isPendingOrConfirmed;
    });

    const completedBookings = bookings.filter((b) => b.status === SpaBookingStatus.COMPLETED);
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.priceSnapshot || 0), 0);

    // Group by service for revenue chart
    const serviceRevenueMap: Record<string, number> = {};
    completedBookings.forEach((b) => {
      const sName = b.service?.name || 'Khác';
      serviceRevenueMap[sName] = (serviceRevenueMap[sName] || 0) + (b.priceSnapshot || 0);
    });
    const revenueByService = Object.entries(serviceRevenueMap).map(([name, value]) => ({ name, value }));

    // Group by status for distribution chart
    const statusCountMap: Record<string, number> = {};
    bookings.forEach((b) => {
      statusCountMap[b.status] = (statusCountMap[b.status] || 0) + 1;
    });
    const statusDistribution = Object.entries(statusCountMap).map(([status, value]) => ({ status, value }));

    return {
      todayBookingsCount: todayBookings.length,
      completedBookingsCount: completedBookings.length,
      totalRevenue,
      staffCount,
      revenueByService,
      statusDistribution,
      todayBookings: todayBookings.map((b) => ({
        id: b.id,
        scheduledAt: b.scheduledAt,
        serviceName: b.service?.name || 'Khác',
        status: b.status,
        petName: b.petName || b.pet?.name || 'Thú cưng',
        customerName: b.user?.name || 'Khách hàng',
        note: b.note,
        staffId: b.staffId,
        staffName: b.staff?.name || null,
      })),
    };
  }

  async getManagerServices(managerId: string) {
    const services = await this.prisma.spaService.findMany({
      include: {
        _count: {
          select: { bookings: true },
        },
        brand: {
          select: { name: true },
        },
      },
    });

    // Sort sorted by booking count (high to low)
    return services.sort((a, b) => b._count.bookings - a._count.bookings);
  }

  async getManagerBrands(managerId: string) {
    return this.prisma.spaBrand.findMany({
      where: { managerId },
    });
  }

  async createManagerService(
    managerId: string,
    dto: { brandId: string; name: string; description?: string; price: number; durationMin: number },
  ) {
    const brand = await this.prisma.spaBrand.findFirst({
      where: { id: dto.brandId, managerId },
    });
    if (!brand) {
      throw new ForbiddenException('Bạn không quản lý thương hiệu này.');
    }

    return this.prisma.spaService.create({
      data: {
        brandId: dto.brandId,
        name: dto.name,
        description: dto.description || null,
        price: Number(dto.price),
        durationMin: Number(dto.durationMin),
        isActive: true,
      },
    });
  }

  async updateManagerService(
    managerId: string,
    serviceId: string,
    dto: { name?: string; description?: string; price?: number; durationMin?: number; isActive?: boolean },
  ) {
    const service = await this.prisma.spaService.findUnique({
      where: { id: serviceId },
      include: { brand: true },
    });

    if (!service) {
      throw new NotFoundException('Dịch vụ không tồn tại.');
    }

    if (service.brand.managerId !== managerId) {
      throw new ForbiddenException('Bạn không quản lý dịch vụ này.');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = Number(dto.price);
    if (dto.durationMin !== undefined) data.durationMin = Number(dto.durationMin);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.spaService.update({
      where: { id: serviceId },
      data,
    });
  }

  async getManagerBookings(managerId: string, branchId: string) {
    await this.autoUpdateBookingStatuses();

    const branch = await this.prisma.addressSpa.findFirst({
      where: { id: branchId, managerId },
    });
    if (!branch) {
      throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
    }

    return this.prisma.spaBooking.findMany({
      where: { addressSpaId: branchId },
      include: {
        service: {
          select: { name: true, price: true, durationMin: true },
        },
        user: {
          select: { name: true, email: true, phone: true, avatarUrl: true },
        },
        pet: true,
        staff: {
          select: { name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });
  }

  async rescheduleBooking(managerId: string, bookingId: string, scheduledAt: string) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    const branch = await this.prisma.addressSpa.findFirst({
      where: { id: booking.addressSpaId!, managerId },
    });
    if (!branch) {
      throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
    }

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        scheduledAt: new Date(scheduledAt),
      },
    });
  }

  async confirmBooking(managerId: string, bookingId: string) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    const branch = await this.prisma.addressSpa.findFirst({
      where: { id: booking.addressSpaId!, managerId },
    });
    if (!branch) {
      throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
    }

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        status: SpaBookingStatus.CONFIRMED,
      },
    });
  }

  async getAvailableStaffForBooking(managerId: string, bookingId: string) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
      include: { service: true },
    });

    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    const branch = await this.prisma.addressSpa.findFirst({
      where: { id: booking.addressSpaId!, managerId },
    });
    if (!branch) {
      throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
    }

    const staffs = await this.prisma.spaStaff.findMany({
      where: { addressSpaId: booking.addressSpaId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const staffIds = staffs.map((s) => s.userId);

    const start = new Date(booking.scheduledAt);
    const duration = booking.service?.durationMin || 30;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const activeBookings = await this.prisma.spaBooking.findMany({
      where: {
        staffId: { in: staffIds },
        status: {
          in: [
            SpaBookingStatus.ASSIGNED,
            SpaBookingStatus.IN_PROGRESS,
            SpaBookingStatus.COMPLETED,
            SpaBookingStatus.CONFIRMED,
            SpaBookingStatus.LATE,
          ],
        },
      },
      include: {
        service: { select: { durationMin: true } },
      },
    });

    const availableStaffs = [];
    for (const staff of staffs) {
      const staffBookings = activeBookings.filter((b) => b.staffId === staff.userId);
      const busy = isStaffBusy(staffBookings, start, end);
      if (!busy) {
        availableStaffs.push({
          id: staff.userId,
          name: staff.user.name,
          email: staff.user.email,
          avatarUrl: staff.user.avatarUrl,
        });
      }
    }

    return availableStaffs;
  }

  async assignStaffToBooking(managerId: string, bookingId: string, staffId: string) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    const branch = await this.prisma.addressSpa.findFirst({
      where: { id: booking.addressSpaId!, managerId },
    });
    if (!branch) {
      throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
    }

    const staff = await this.prisma.spaStaff.findFirst({
      where: { userId: staffId, addressSpaId: booking.addressSpaId },
    });
    if (!staff) {
      throw new BadRequestException('Nhân viên không thuộc chi nhánh này.');
    }

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        staffId,
        status: SpaBookingStatus.ASSIGNED,
      },
    });
  }

  async getManagerStaffs(managerId: string, branchId: string) {
    await this.autoUpdateBookingStatuses();

    const branch = await this.prisma.addressSpa.findFirst({
      where: { id: branchId, managerId },
    });
    if (!branch) {
      throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
    }

    const staffs = await this.prisma.spaStaff.findMany({
      where: { addressSpaId: branchId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const staffIds = staffs.map((s) => s.userId);

    const bookings = await this.prisma.spaBooking.findMany({
      where: {
        staffId: { in: staffIds },
        addressSpaId: branchId,
      },
      include: {
        service: {
          select: { price: true },
        },
      },
    });

    return staffs.map((staff) => {
      const staffBookings = bookings.filter((b) => b.staffId === staff.userId);
      const completed = staffBookings.filter((b) => b.status === SpaBookingStatus.COMPLETED);
      const active = staffBookings.filter((b) =>
        b.status === SpaBookingStatus.ASSIGNED ||
        b.status === SpaBookingStatus.IN_PROGRESS ||
        b.status === SpaBookingStatus.LATE
      );

      const revenue = completed.reduce((sum, b) => sum + (b.priceSnapshot || b.service?.price || 0), 0);

      return {
        id: staff.id,
        userId: staff.userId,
        name: staff.user.name,
        email: staff.user.email,
        avatarUrl: staff.user.avatarUrl,
        completedCount: completed.length,
        activeCount: active.length,
        revenue,
      };
    });
  }

  async getAvailability(branchId: string, dateStr: string, durationMin: number = 30) {
    await this.autoUpdateBookingStatuses();

    const staffs = await this.prisma.spaStaff.findMany({
      where: { addressSpaId: branchId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const staffIds = staffs.map((s) => s.userId);

    const targetDate = new Date(dateStr);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const activeBookings = await this.prisma.spaBooking.findMany({
      where: {
        staffId: { in: staffIds },
        status: {
          in: [
            SpaBookingStatus.ASSIGNED,
            SpaBookingStatus.IN_PROGRESS,
            SpaBookingStatus.COMPLETED,
            SpaBookingStatus.CONFIRMED,
            SpaBookingStatus.LATE,
          ],
        },
        scheduledAt: {
          gte: new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(endOfDay.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        service: {
          select: { durationMin: true },
        },
      },
    });

    const timeSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
      '17:00', '17:30',
    ];

    const result = [];

    for (const timeStr of timeSlots) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const slotStart = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        hours,
        minutes,
        0,
        0,
      );
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60 * 1000);

      const availableStaffs = [];

      for (const staff of staffs) {
        const staffBookings = activeBookings.filter((b) => b.staffId === staff.userId);
        const busy = isStaffBusy(staffBookings, slotStart, slotEnd);
        if (!busy) {
          availableStaffs.push({
            id: staff.userId,
            name: staff.user.name,
            email: staff.user.email,
            avatarUrl: staff.user.avatarUrl,
          });
        }
      }

      result.push({
        time: timeStr,
        isAvailable: availableStaffs.length > 0,
        remainingSlots: availableStaffs.length,
        availableStaffs,
      });
    }

    return result;
  }
}

function isStaffBusy(staffBookings: any[], candidateStart: Date, candidateEnd: Date): boolean {
  for (const b of staffBookings) {
    if (
      b.status === SpaBookingStatus.CANCELLED ||
      b.status === SpaBookingStatus.NO_SHOW ||
      b.status === SpaBookingStatus.COMPLETED
    ) {
      continue;
    }
    let start = new Date(b.scheduledAt);
    const duration = b.service?.durationMin || 30;
    let end = new Date(start.getTime() + duration * 60 * 1000);

    if (b.status === SpaBookingStatus.IN_PROGRESS) {
      start = new Date(b.updatedAt);
      end = new Date(start.getTime() + duration * 60 * 1000);
    }

    if (start < candidateEnd && end > candidateStart) {
      return true; // Overlaps
    }
  }
  return false;
}

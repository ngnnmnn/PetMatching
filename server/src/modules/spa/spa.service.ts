import { Injectable, NotFoundException, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ApprovalStatus, SpaBookingStatus, AccountStatus, UserRole, Species } from '@prisma/client';

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

  async getServices(species?: Species, weight?: number) {
    let services = await this.prisma.spaService.findMany({
      where: {
        isActive: true,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            isMain: true,
          },
        },
      },
    });

    if (species && weight !== undefined) {
      const numWeight = Number(weight);
      services = services.filter((s) => {
        if (!s.isMain) {
          if (!s.species) return true;
          if (s.species !== species) return false;
          if (s.petWeightMin !== null && s.petWeightMax !== null) {
            return numWeight >= s.petWeightMin && numWeight <= s.petWeightMax;
          }
          return true;
        }

        const matchSpecies = !s.species || s.species === species;
        const minW = s.petWeightMin ?? 0;
        const maxW = s.petWeightMax ?? 999;
        const matchWeight = numWeight >= minW && (numWeight < maxW || maxW === 100);
        return matchSpecies && matchWeight;
      });
    }

    return services;
  }

  async createBooking(userId: string, dto: CreateBookingDto) {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    let validPetId: string | null = null;
    if (dto.petId) {
      const petExists = await this.prisma.pet.findUnique({
        where: { id: dto.petId },
        select: { id: true },
      });
      if (petExists) {
        validPetId = petExists.id;
      }
    }

    let validAddressSpaId: string | null = null;
    if (dto.addressSpaId) {
      const addressExists = await this.prisma.addressSpa.findUnique({
        where: { id: dto.addressSpaId },
        select: { id: true },
      });
      if (addressExists) {
        validAddressSpaId = addressExists.id;
      }
    }

    let validStaffId: string | null = null;
    if (dto.staffId) {
      const staffExists = await this.prisma.user.findUnique({
        where: { id: dto.staffId },
        select: { id: true },
      });
      if (staffExists) {
        validStaffId = staffExists.id;
      }
    }

    const mainServiceId = dto.mainServiceId || dto.serviceId || null;
    const subServiceIds = dto.subServiceIds || [];

    if (!mainServiceId && subServiceIds.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 dịch vụ chính hoặc 1 dịch vụ lẻ.');
    }

    let mainService: any = null;
    if (mainServiceId) {
      mainService = await this.prisma.spaService.findUnique({
        where: { id: mainServiceId },
      });

      if (!mainService || !mainService.isActive) {
        throw new NotFoundException('Dịch vụ Spa chính không tồn tại hoặc đã dừng hoạt động.');
      }
    }

    let subServices: any[] = [];
    if (subServiceIds.length > 0) {
      subServices = await this.prisma.spaService.findMany({
        where: {
          id: { in: subServiceIds },
          isActive: true,
        },
      });
    }

    const firstService = mainService || subServices[0];
    const brandId = dto.branchId || (firstService ? firstService.brandId : null);
    const bookingTime = new Date(dto.scheduledAt);

    if (isNaN(bookingTime.getTime())) {
      throw new BadRequestException('Thời gian đặt lịch không hợp lệ.');
    }

    if (bookingTime.getTime() <= Date.now()) {
      throw new BadRequestException('Thời gian đặt lịch phải ở trong tương lai.');
    }

    // Calculate total price & expected duration
    const mainPrice = mainService ? mainService.price : 0;
    const subPriceTotal = subServices.reduce((sum, s) => sum + s.price, 0);
    const totalPrice = mainPrice + subPriceTotal;

    const mainDuration = mainService ? (mainService.durationMax || mainService.durationMin || 30) : 0;
    const subDurationTotal = subServices.reduce((sum, s) => sum + (s.durationMax || s.durationMin || 15), 0);
    const totalDurationMinutes = mainDuration + subDurationTotal;

    const timeStartExpected = bookingTime;
    const timeEndExpected = new Date(bookingTime.getTime() + totalDurationMinutes * 60 * 1000);

    const bookingStatus = validStaffId ? SpaBookingStatus.ASSIGNED : SpaBookingStatus.PENDING;

    return this.prisma.spaBooking.create({
      data: {
        userId,
        brandId,
        addressSpaId: validAddressSpaId,
        serviceId: mainServiceId,
        mainServiceId: mainServiceId,
        subServiceIds: subServiceIds,
        staffId: validStaffId,
        petId: validPetId,
        petName: dto.petName || 'Thú cưng',
        petSpecies: dto.petSpecies || null,
        petWeight: dto.petWeight ? Number(dto.petWeight) : null,
        scheduledAt: bookingTime,
        status: bookingStatus,
        priceSnapshot: mainService ? mainService.price : totalPrice,
        totalPrice,
        discountAmount: 0,
        timeStartExpected,
        timeEndExpected,
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

    // Check cancellation policy: at least 2 hours before scheduledAt
    const now = Date.now();
    const scheduleTime = new Date(booking.scheduledAt).getTime();
    if (scheduleTime - now < 2 * 60 * 60 * 1000) {
      throw new BadRequestException('Bạn chỉ có thể hủy lịch đặt Spa trước thời gian hẹn tối thiểu 2 tiếng.');
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

    const staffProfile = await this.prisma.spaStaff.findUnique({
      where: { userId: staffId },
    });
    const branchId = staffProfile?.addressSpaId;

    return this.prisma.spaBooking.findMany({
      where: {
        OR: [
          { staffId },
          ...(branchId ? [{ addressSpaId: branchId }] : []),
        ],
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

  async staffCheckIn(staffId: string, bookingId: string) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    const now = new Date();
    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        status: SpaBookingStatus.CHECK_IN,
        timeStartReal: now,
      },
      include: {
        service: true,
        user: true,
        pet: true,
      },
    });
  }

  async staffAddSubServices(staffId: string, bookingId: string, subServiceIds: string[]) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    const newSubIds = Array.from(new Set([...booking.subServiceIds, ...subServiceIds]));
    
    // Fetch main service & all sub services
    const mainServiceId = booking.mainServiceId || booking.serviceId;
    const mainService = mainServiceId ? await this.prisma.spaService.findUnique({ where: { id: mainServiceId } }) : null;
    const subServices = await this.prisma.spaService.findMany({
      where: { id: { in: newSubIds } },
    });

    const mainPrice = mainService ? mainService.price : (booking.priceSnapshot || 0);
    const subPriceTotal = subServices.reduce((sum, s) => sum + s.price, 0);
    const totalPrice = Math.max(0, mainPrice + subPriceTotal - (booking.discountAmount || 0));

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        subServiceIds: newSubIds,
        totalPrice,
      },
      include: {
        service: true,
        user: true,
        pet: true,
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

    const updatedData: any = {};
    if (dto.status !== undefined) {
      updatedData.status = dto.status;
      if (dto.status === SpaBookingStatus.IN_PROGRESS && !booking.timeStartReal) {
        updatedData.timeStartReal = new Date();
      }
      if (dto.status === SpaBookingStatus.COMPLETED) {
        const timeEndReal = new Date();
        updatedData.timeEndReal = timeEndReal;

        const timeEndExpected = booking.timeEndExpected || new Date(booking.scheduledAt.getTime() + 45 * 60 * 1000);
        const completionDiffMinutes = Math.round((timeEndReal.getTime() - timeEndExpected.getTime()) / 60000);
        updatedData.completionDiffMinutes = completionDiffMinutes;
      }
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

    // 1. ASSIGNED -> LATE if scheduledAt in past and not yet in progress
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

    // 2. LATE -> NO_SHOW if 15 minutes past scheduledAt without check-in
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

    const branch = await this.prisma.addressSpa.findFirst({
      where: { id: branchId, managerId },
    });
    if (!branch) {
      throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
    }

    const staffCount = await this.prisma.spaStaff.count({
      where: { addressSpaId: branchId },
    });

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
      const isPendingOrConfirmed = b.status === SpaBookingStatus.PENDING || b.status === SpaBookingStatus.CONFIRMED || b.status === SpaBookingStatus.CHECK_IN;
      return isToday || isPendingOrConfirmed;
    });

    const completedBookings = bookings.filter((b) => b.status === SpaBookingStatus.COMPLETED);
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalPrice || b.priceSnapshot || 0), 0);

    const serviceRevenueMap: Record<string, number> = {};
    completedBookings.forEach((b) => {
      const sName = b.service?.name || 'Khác';
      serviceRevenueMap[sName] = (serviceRevenueMap[sName] || 0) + (b.totalPrice || b.priceSnapshot || 0);
    });
    const revenueByService = Object.entries(serviceRevenueMap).map(([name, value]) => ({ name, value }));

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
        totalPrice: b.totalPrice,
        discountAmount: b.discountAmount,
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

    return services.sort((a, b) => b._count.bookings - a._count.bookings);
  }

  async getManagerBrands(managerId: string) {
    return this.prisma.spaBrand.findMany({
      where: {
        OR: [
          { managerId },
          { managerId: null },
        ],
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createManagerService(
    managerId: string,
    dto: {
      brandId: string;
      name: string;
      description?: string;
      price: number;
      durationMin: number;
      durationMax?: number;
      species?: Species;
      petWeightMin?: number;
      petWeightMax?: number;
      isMain?: boolean;
    },
  ) {
    const brand = await this.prisma.spaBrand.findFirst({
      where: {
        id: dto.brandId,
        OR: [
          { managerId },
          { managerId: null },
        ],
      },
    });
    if (!brand) {
      throw new ForbiddenException('Thương hiệu Spa không tồn tại hoặc bạn không có quyền.');
    }

    return this.prisma.spaService.create({
      data: {
        brandId: dto.brandId,
        name: dto.name,
        description: dto.description || null,
        price: Number(dto.price),
        durationMin: Number(dto.durationMin),
        durationMax: dto.durationMax ? Number(dto.durationMax) : null,
        species: dto.species || null,
        petWeightMin: (dto.petWeightMin !== undefined && dto.petWeightMin !== null && dto.petWeightMin !== ('' as any)) ? Number(dto.petWeightMin) : null,
        petWeightMax: (dto.petWeightMax !== undefined && dto.petWeightMax !== null && dto.petWeightMax !== ('' as any)) ? Number(dto.petWeightMax) : null,
        isMain: dto.isMain ?? true,
        isActive: true,
      },
    });
  }

  async updateManagerService(
    managerId: string,
    serviceId: string,
    dto: {
      brandId?: string;
      name?: string;
      description?: string;
      price?: number;
      durationMin?: number;
      durationMax?: number;
      species?: Species;
      petWeightMin?: number;
      petWeightMax?: number;
      isMain?: boolean;
      isActive?: boolean;
    },
  ) {
    const service = await this.prisma.spaService.findUnique({
      where: { id: serviceId },
      include: { brand: true },
    });

    if (!service) {
      throw new NotFoundException('Dịch vụ không tồn tại.');
    }

    if (service.brand.managerId && service.brand.managerId !== managerId) {
      throw new ForbiddenException('Bạn không quản lý dịch vụ này.');
    }

    const data: any = {};
    if (dto.brandId !== undefined) data.brandId = dto.brandId;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = Number(dto.price);
    if (dto.durationMin !== undefined) data.durationMin = Number(dto.durationMin);
    if (dto.durationMax !== undefined) data.durationMax = dto.durationMax ? Number(dto.durationMax) : null;
    if (dto.species !== undefined) data.species = dto.species || null;
    if (dto.petWeightMin !== undefined) data.petWeightMin = (dto.petWeightMin !== null && dto.petWeightMin !== ('' as any)) ? Number(dto.petWeightMin) : null;
    if (dto.petWeightMax !== undefined) data.petWeightMax = (dto.petWeightMax !== null && dto.petWeightMax !== ('' as any)) ? Number(dto.petWeightMax) : null;
    if (dto.isMain !== undefined) data.isMain = dto.isMain;
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

  async managerReassignStaff(managerId: string, bookingId: string, newStaffId: string) {
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
      where: { userId: newStaffId, addressSpaId: booking.addressSpaId },
    });
    if (!staff) {
      throw new BadRequestException('Nhân viên không thuộc chi nhánh này.');
    }

    // Check staff availability during full expected duration
    const start = booking.timeStartExpected || booking.scheduledAt;
    const end = booking.timeEndExpected || new Date(start.getTime() + 45 * 60 * 1000);

    const activeBookings = await this.prisma.spaBooking.findMany({
      where: {
        staffId: newStaffId,
        id: { not: bookingId },
        status: {
          in: [
            SpaBookingStatus.ASSIGNED,
            SpaBookingStatus.IN_PROGRESS,
            SpaBookingStatus.CONFIRMED,
            SpaBookingStatus.CHECK_IN,
            SpaBookingStatus.LATE,
          ],
        },
      },
    });

    const busy = isStaffBusy(activeBookings, start, end);
    if (busy) {
      throw new BadRequestException('Nhân viên này đang bận trong khoảng thời gian của ca làm việc.');
    }

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        staffId: newStaffId,
        status: SpaBookingStatus.ASSIGNED,
      },
    });
  }

  async managerApplyLateDiscount(managerId: string, bookingId: string) {
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

    // Default 10% discount if past 30 mins from scheduledAt and not completed/cancelled
    const discountAmount = Math.round((booking.totalPrice || booking.priceSnapshot || 0) * 0.1);
    const newTotalPrice = Math.max(0, (booking.totalPrice || booking.priceSnapshot || 0) - discountAmount);

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        discountAmount,
        totalPrice: newTotalPrice,
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

    const newStart = new Date(scheduledAt);
    const durationMs = (booking.timeEndExpected && booking.timeStartExpected)
      ? (booking.timeEndExpected.getTime() - booking.timeStartExpected.getTime())
      : 45 * 60 * 1000;
    const newEnd = new Date(newStart.getTime() + durationMs);

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        scheduledAt: newStart,
        timeStartExpected: newStart,
        timeEndExpected: newEnd,
      },
    });
  }

  async managerUpdateBookingServices(managerId: string, bookingId: string, mainServiceId: string, subServiceIds: string[] = []) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    const mainService = await this.prisma.spaService.findUnique({ where: { id: mainServiceId } });
    if (!mainService) {
      throw new NotFoundException('Dịch vụ chính không tồn tại.');
    }

    const subServices = await this.prisma.spaService.findMany({
      where: { id: { in: subServiceIds } },
    });

    const mainPrice = mainService.price;
    const subPriceTotal = subServices.reduce((sum, s) => sum + s.price, 0);
    const totalPrice = Math.max(0, mainPrice + subPriceTotal - (booking.discountAmount || 0));

    const mainDuration = mainService.durationMax || mainService.durationMin || 30;
    const subDurationTotal = subServices.reduce((sum, s) => sum + (s.durationMax || s.durationMin || 15), 0);
    const totalDurationMinutes = mainDuration + subDurationTotal;

    const start = booking.timeStartExpected || booking.scheduledAt;
    const newEnd = new Date(start.getTime() + totalDurationMinutes * 60 * 1000);

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        serviceId: mainServiceId,
        mainServiceId: mainServiceId,
        subServiceIds: subServiceIds,
        totalPrice,
        timeEndExpected: newEnd,
      },
    });
  }

  async getManagerStaffPerformance(managerId: string, branchId: string, filter?: 'ALL' | 'ON_TIME' | 'LATE') {
    const branch = await this.prisma.addressSpa.findFirst({
      where: { id: branchId, managerId },
    });
    if (!branch) {
      throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
    }

    const completedBookings = await this.prisma.spaBooking.findMany({
      where: {
        addressSpaId: branchId,
        status: SpaBookingStatus.COMPLETED,
      },
      include: {
        staff: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        service: true,
        user: {
          select: { name: true, phone: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    let result = completedBookings.map((b) => {
      const diff = b.completionDiffMinutes ?? 0;
      const isLate = diff > 0;
      return {
        ...b,
        isLate,
        diffMinutes: Math.abs(diff),
        statusText: isLate ? `Muộn ${diff} phút` : `Đúng giờ / Sớm ${Math.abs(diff)} phút`,
      };
    });

    if (filter === 'ON_TIME') {
      result = result.filter((b) => !b.isLate);
    } else if (filter === 'LATE') {
      result = result.filter((b) => b.isLate);
    }

    return result;
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

    const start = booking.timeStartExpected || new Date(booking.scheduledAt);
    const end = booking.timeEndExpected || new Date(start.getTime() + 45 * 60 * 1000);

    const activeBookings = await this.prisma.spaBooking.findMany({
      where: {
        staffId: { in: staffIds },
        status: {
          in: [
            SpaBookingStatus.ASSIGNED,
            SpaBookingStatus.IN_PROGRESS,
            SpaBookingStatus.COMPLETED,
            SpaBookingStatus.CONFIRMED,
            SpaBookingStatus.CHECK_IN,
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
        b.status === SpaBookingStatus.CHECK_IN ||
        b.status === SpaBookingStatus.LATE
      );

      const onTimeBookings = completed.filter((b) => (b.completionDiffMinutes ?? 0) <= 0);
      const lateBookings = completed.filter((b) => (b.completionDiffMinutes ?? 0) > 0);
      const onTimeRate = completed.length > 0 ? Math.round((onTimeBookings.length / completed.length) * 100) : 100;
      const revenue = completed.reduce((sum, b) => sum + (b.totalPrice || b.priceSnapshot || b.service?.price || 0), 0);

      return {
        id: staff.id,
        userId: staff.userId,
        name: staff.user.name,
        email: staff.user.email,
        avatarUrl: staff.user.avatarUrl,
        completedCount: completed.length,
        activeCount: active.length,
        onTimeCount: onTimeBookings.length,
        lateCount: lateBookings.length,
        onTimeRate,
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
            SpaBookingStatus.CHECK_IN,
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
    let start = new Date(b.timeStartExpected || b.scheduledAt);
    const duration = b.service?.durationMin || 30;
    let end = new Date(b.timeEndExpected || start.getTime() + duration * 60 * 1000);

    if (b.status === SpaBookingStatus.IN_PROGRESS && b.timeStartReal) {
      start = new Date(b.timeStartReal);
      end = new Date(start.getTime() + duration * 60 * 1000);
    }

    if (start < candidateEnd && end > candidateStart) {
      return true; // Overlaps
    }
  }
  return false;
}

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBookingDto, CreateStaffDto, CreateSpaFeedbackDto } from './dto/create-booking.dto';
import { ApprovalStatus, SpaBookingStatus, AccountStatus, UserRole, Species } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SpaService {
  constructor(private readonly prisma: PrismaService) { }

  async getBranches() {
    return this.prisma.spaCategory.findMany({
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

  async getCategories() {
    return this.prisma.spaCategory.findMany({
      where: {
        status: ApprovalStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async getServices(species?: Species, weight?: number) {
    let services = await this.prisma.spaService.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: {
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
    const categoryId = dto.branchId || (firstService ? (firstService.categoryId || (firstService as any).brandId) : null);
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

    // Validate operating hours: 09:00 - 18:00
    const startHour = bookingTime.getHours();
    const startMin = bookingTime.getMinutes();
    const startMinsFromMidnight = startHour * 60 + startMin;
    const endMinsFromMidnight = startMinsFromMidnight + totalDurationMinutes;

    const isValidOperatingHours = startMinsFromMidnight >= 9 * 60 && endMinsFromMidnight <= 18 * 60;

    if (!isValidOperatingHours) {
      throw new BadRequestException(
        `Thời gian dịch vụ (${totalDurationMinutes} phút) vượt quá khung giờ hoạt động của Spa (09:00 - 18:00). Vui lòng chọn khung giờ sớm hơn.`
      );
    }

    const bookingStatus = validStaffId ? SpaBookingStatus.ASSIGNED : SpaBookingStatus.PENDING;

    return this.prisma.spaBooking.create({
      data: {
        userId,
        categoryId: categoryId,
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
        category: {
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
    const bookings = await this.prisma.spaBooking.findMany({
      where: {
        userId,
      },
      include: {
        category: {
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
            id: true,
            name: true,
            description: true,
            price: true,
          },
        },
        pet: true,
        staff: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
        feedback: true,
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });

    const allSubServiceIds = Array.from(
      new Set(bookings.flatMap((b) => b.subServiceIds || []))
    );

    const subServicesList =
      allSubServiceIds.length > 0
        ? await this.prisma.spaService.findMany({
          where: { id: { in: allSubServiceIds } },
          select: { id: true, name: true, price: true, description: true },
        })
        : [];

    const subServicesMap = new Map(subServicesList.map((s) => [s.id, s]));

    return bookings.map((b) => {
      const subServices = (b.subServiceIds || [])
        .map((id) => subServicesMap.get(id))
        .filter(Boolean);

      // Use actual totalPrice from DB (saved at booking creation time = mainPrice + subTotal - discount)
      // Only fallback to recompute if totalPrice is missing
      const mainPrice = b.priceSnapshot || b.service?.price || 0;
      const subServicesTotal = subServices.reduce((sum, s) => sum + (s?.price || 0), 0);
      const totalPrice = b.totalPrice ?? Math.max(0, mainPrice + subServicesTotal - (b.discountAmount || 0));

      return {
        ...b,
        priceSnapshot: mainPrice,
        totalPrice,
        subServicesTotal,
        subServices,
      };
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

    const bookings = await this.prisma.spaBooking.findMany({
      where: {
        staffId: staffId,
      },
      include: {
        category: {
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
            id: true,
            name: true,
            description: true,
            price: true,
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

    const allMainServiceIds = Array.from(
      new Set(bookings.map((b) => b.serviceId || b.mainServiceId).filter(Boolean))
    );
    const allSubServiceIds = Array.from(
      new Set(bookings.flatMap((b) => b.subServiceIds || []))
    );
    const allServiceIds = Array.from(new Set([...allMainServiceIds, ...allSubServiceIds]));

    const servicesList =
      allServiceIds.length > 0
        ? await this.prisma.spaService.findMany({
          where: { id: { in: allServiceIds as string[] } },
          select: { id: true, name: true, price: true, description: true, isMain: true },
        })
        : [];

    const servicesMap = new Map(servicesList.map((s) => [s.id, s]));

    return bookings.map((b) => {
      const targetMainId = b.serviceId || b.mainServiceId;
      const mainServiceResolved = b.service || (targetMainId ? servicesMap.get(targetMainId) : null);
      const subServices = (b.subServiceIds || [])
        .map((id) => servicesMap.get(id))
        .filter(Boolean);

      // Use actual totalPrice from DB; only fallback recompute if missing
      const mainPrice = b.priceSnapshot || (mainServiceResolved as any)?.price || 0;
      const subServicesTotal = subServices.length > 0
        ? subServices.reduce((sum, s) => sum + ((s as any)?.price || 0), 0)
        : 0;
      const totalPrice = b.totalPrice ?? Math.max(0, mainPrice + subServicesTotal - (b.discountAmount || 0));

      // Compute sub-revenue: if sub-services can't be resolved, compute from totalPrice - mainPrice
      const subRevenue = Math.max(0, totalPrice - mainPrice - (b.discountAmount || 0));

      // Build sub-services display list:
      // - If IDs resolve → use actual objects
      // - If IDs don't resolve but exist → create placeholder items with distributed price
      let subServicesDisplay: any[] = subServices;
      if (subServices.length === 0 && (b.subServiceIds || []).length > 0) {
        const count = (b.subServiceIds || []).length;
        const pricePerService = count > 0 ? Math.round(subRevenue / count) : 0;
        subServicesDisplay = (b.subServiceIds || []).map((id, i) => ({
          id,
          name: `Dịch vụ lẻ #${i + 1}`,
          price: pricePerService,
          isMain: false,
        }));
      }

      return {
        ...b,
        priceSnapshot: mainPrice,
        totalPrice,
        subServicesTotal: subRevenue,
        subServices: subServicesDisplay,
        mainServiceResolved,
      };
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
        category: {
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
        spaStaffProfile: {
          status: 'ACTIVE',
        },
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

  async getPublicFeedbacks() {
    return this.prisma.spaFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        booking: {
          include: {
            service: {
              select: { id: true, name: true },
            },
            category: {
              select: { id: true, name: true },
            },
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
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // 1. Any booking 30+ minutes past scheduledAt without check-in -> NO_SHOW automatically
    const noShowBookings = await this.prisma.spaBooking.findMany({
      where: {
        status: {
          in: [
            SpaBookingStatus.PENDING,
            SpaBookingStatus.CONFIRMED,
            SpaBookingStatus.ASSIGNED,
            SpaBookingStatus.LATE,
          ],
        },
        scheduledAt: { lt: thirtyMinsAgo },
      },
    });
    if (noShowBookings.length > 0) {
      await this.prisma.spaBooking.updateMany({
        where: { id: { in: noShowBookings.map((b) => b.id) } },
        data: { status: SpaBookingStatus.NO_SHOW },
      });
    }

    // 2. ASSIGNED -> LATE if scheduledAt in past (0 to 30 mins ago) and not yet in progress
    const lateBookings = await this.prisma.spaBooking.findMany({
      where: {
        status: SpaBookingStatus.ASSIGNED,
        scheduledAt: { lt: now, gte: thirtyMinsAgo },
      },
    });
    if (lateBookings.length > 0) {
      await this.prisma.spaBooking.updateMany({
        where: { id: { in: lateBookings.map((b) => b.id) } },
        data: { status: SpaBookingStatus.LATE },
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

    const targetBranch = (branchId && branchId !== 'ALL') ? branchId : undefined;

    const staffCount = await this.prisma.spaStaff.count({
      where: targetBranch ? { addressSpaId: targetBranch } : {},
    });

    const bookings = await this.prisma.spaBooking.findMany({
      where: targetBranch ? { addressSpaId: targetBranch } : {},
      include: {
        service: {
          include: { category: true },
        },
        category: true,
        user: true,
        pet: true,
        staff: true,
        feedback: true,
      },
    });

    const allMainServiceIds = Array.from(
      new Set(bookings.map((b) => b.serviceId || b.mainServiceId).filter(Boolean))
    );
    const allSubServiceIds = Array.from(
      new Set(bookings.flatMap((b) => b.subServiceIds || []))
    );

    const allServiceIds = Array.from(new Set([...allMainServiceIds, ...allSubServiceIds]));

    const servicesList = allServiceIds.length > 0
      ? await this.prisma.spaService.findMany({
        where: { id: { in: allServiceIds as string[] } },
        include: { category: true },
      })
      : [];

    const servicesMap = new Map(servicesList.map((s) => [s.id, s]));

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
    // totalRevenue uses the actual totalPrice stored in DB (= mainPrice + subServicesTotal at booking time)
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalPrice ?? b.priceSnapshot ?? 0), 0);

    const categoriesList = await this.prisma.spaCategory.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const categoryMap = new Map<string, { id: string; name: string; revenue: number; ratings: number[] }>();
    for (const c of categoriesList) {
      categoryMap.set(c.id, {
        id: c.id,
        name: c.name,
        revenue: 0,
        ratings: [],
      });
    }

    function findCategoryForService(service?: any, bookingCatId?: string | null): string {
      if (service?.categoryId && categoryMap.has(service.categoryId)) {
        return service.categoryId;
      }
      if (bookingCatId && categoryMap.has(bookingCatId)) {
        return bookingCatId;
      }
      const sName = (service?.name || '').toLowerCase();
      for (const cat of categoriesList) {
        const cName = cat.name.toLowerCase();
        if (sName.includes(cName) || (cName.length > 2 && sName.includes(cName.substring(0, 3)))) {
          return cat.id;
        }
      }
      return categoriesList[0]?.id || '';
    }

    // Find the "Dịch vụ lẻ" category id (isMain = false)
    const subServiceCategoryId = categoriesList.find((c) => c.isMain === false)?.id
      || categoriesList.find((c) => c.name.toLowerCase().includes('lẻ'))?.id
      || categoriesList[categoriesList.length - 1]?.id
      || '';

    completedBookings.forEach((b) => {
      const targetId = b.serviceId || b.mainServiceId;
      const mainService = b.service || (targetId ? servicesMap.get(targetId) : null);
      const resolvedSubServices = (b.subServiceIds || []).map((id) => servicesMap.get(id)).filter(Boolean);

      // Main service price = priceSnapshot (snapshotted at booking time)
      const mainPrice = b.priceSnapshot || (mainService as any)?.price || 0;
      const bookingTotal = b.totalPrice ?? b.priceSnapshot ?? 0;

      // Revenue that belongs to sub-services = totalPrice - mainPrice (- discount already included in totalPrice)
      const subRevenue = Math.max(0, bookingTotal - mainPrice);

      // Distribute main service revenue to its category
      const mainCatId = findCategoryForService(mainService, b.categoryId);
      const targetMain = categoryMap.get(mainCatId);
      if (targetMain) {
        targetMain.revenue += mainPrice;
        if (b.feedback && typeof b.feedback.rateServices === 'number') {
          targetMain.ratings.push(b.feedback.rateServices);
        }
      }

      if (subRevenue > 0) {
        if (resolvedSubServices.length > 0) {
          // Sub-services found in DB: distribute by each sub-service's own category
          const resolvedSubTotal = resolvedSubServices.reduce((sum: number, s: any) => sum + (s?.price || 0), 0);
          resolvedSubServices.forEach((s: any) => {
            const subCatId = findCategoryForService(s, null);
            const targetSub = categoryMap.get(subCatId);
            if (targetSub) {
              // Scale by ratio in case catalog prices differ from booking time
              const ratio = resolvedSubTotal > 0 ? (s?.price || 0) / resolvedSubTotal : 0;
              targetSub.revenue += Math.round(subRevenue * ratio);
              if (b.feedback && typeof b.feedback.rateServices === 'number') {
                targetSub.ratings.push(b.feedback.rateServices);
              }
            }
          });
        } else {
          // Sub-service IDs not found in DB (old data): put all remaining revenue into "Dịch vụ lẻ"
          const fallbackSub = categoryMap.get(subServiceCategoryId);
          if (fallbackSub) {
            fallbackSub.revenue += subRevenue;
            if (b.feedback && typeof b.feedback.rateServices === 'number') {
              fallbackSub.ratings.push(b.feedback.rateServices);
            }
          }
        }
      }
    });

    const categoryBreakdown = categoriesList.map((cat) => {
      const data = categoryMap.get(cat.id) || { revenue: 0, ratings: [] as number[] };
      const avgRating = data.ratings.length > 0
        ? Math.round((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 10) / 10
        : 0;
      return {
        id: cat.id,
        name: cat.name,
        value: data.revenue,
        avgRating,
        ratingCount: data.ratings.length,
      };
    });

    const statusCountMap: Record<string, number> = {};
    bookings.forEach((b) => {
      statusCountMap[b.status] = (statusCountMap[b.status] || 0) + 1;
    });
    const statusDistribution = Object.entries(statusCountMap).map(([status, value]) => ({ status, value }));

    const unconfirmedBookingsCount = bookings.filter(
      (b) => b.status === SpaBookingStatus.PENDING
    ).length;

    return {
      todayBookingsCount: todayBookings.length,
      unconfirmedBookingsCount,
      completedBookingsCount: completedBookings.length,
      totalRevenue,
      staffCount,
      revenueByService: categoryBreakdown,
      categoryBreakdown,
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
    const [services, allBookings] = await Promise.all([
      this.prisma.spaService.findMany({
        include: {
          category: {
            select: { name: true },
          },
        },
      }),
      this.prisma.spaBooking.findMany({
        select: { serviceId: true, subServiceIds: true },
      }),
    ]);

    // Compute exact booking counts including main service & sub-services (subServiceIds)
    const bookingCountsMap: Record<string, number> = {};
    for (const b of allBookings) {
      if (b.serviceId) {
        bookingCountsMap[b.serviceId] = (bookingCountsMap[b.serviceId] || 0) + 1;
      }
      if (Array.isArray(b.subServiceIds)) {
        for (const subId of b.subServiceIds) {
          bookingCountsMap[subId] = (bookingCountsMap[subId] || 0) + 1;
        }
      }
    }

    const servicesWithCount = services.map((s) => ({
      ...s,
      _count: {
        bookings: bookingCountsMap[s.id] || 0,
      },
    }));

    return servicesWithCount.sort((a, b) => b._count.bookings - a._count.bookings);
  }

  async getManagerCategories(managerId: string) {
    const [categories, allBookings] = await Promise.all([
      this.prisma.spaCategory.findMany({
        where: {
          OR: [
            { managerId },
            { managerId: null },
          ],
        },
        include: {
          services: {
            select: { id: true },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      this.prisma.spaBooking.findMany({
        select: { categoryId: true, serviceId: true, subServiceIds: true },
      }),
    ]);

    return categories.map((c) => {
      const serviceIds = c.services.map((s) => s.id);
      let catBookingCount = 0;

      for (const b of allBookings) {
        const isDirectCat = b.categoryId === c.id;
        const isMainInCat = b.serviceId ? serviceIds.includes(b.serviceId) : false;
        const isSubInCat = Array.isArray(b.subServiceIds)
          ? b.subServiceIds.some((id) => serviceIds.includes(id))
          : false;

        if (isDirectCat || isMainInCat || isSubInCat) {
          catBookingCount++;
        }
      }

      return {
        ...c,
        _count: {
          services: c.services.length,
          bookings: catBookingCount,
        },
      };
    });
  }

  async createManagerCategory(
    managerId: string,
    dto: {
      name: string;
      description?: string;
      isMain?: boolean;
      status?: ApprovalStatus;
    },
  ) {
    if (!dto.name || dto.name.trim().length < 2) {
      throw new BadRequestException('Tên danh mục phải có ít nhất 2 ký tự.');
    }

    return this.prisma.spaCategory.create({
      data: {
        name: dto.name.trim(),
        description: dto.description ? dto.description.trim() : null,
        isMain: dto.isMain ?? true,
        status: dto.status || ApprovalStatus.ACTIVE,
        managerId,
      },
    });
  }

  async updateManagerCategory(
    managerId: string,
    categoryId: string,
    dto: {
      name?: string;
      description?: string;
      isMain?: boolean;
      status?: ApprovalStatus;
    },
  ) {
    const existing = await this.prisma.spaCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      throw new NotFoundException('Danh mục không tồn tại.');
    }

    if (existing.managerId && existing.managerId !== managerId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa danh mục này.');
    }

    const data: any = {};
    if (dto.name !== undefined) {
      if (!dto.name || dto.name.trim().length < 2) {
        throw new BadRequestException('Tên danh mục phải có ít nhất 2 ký tự.');
      }
      data.name = dto.name.trim();
    }
    if (dto.description !== undefined) data.description = dto.description ? dto.description.trim() : null;
    if (dto.isMain !== undefined) data.isMain = dto.isMain;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.spaCategory.update({
      where: { id: categoryId },
      data,
    });
  }

  async deleteManagerCategory(managerId: string, categoryId: string) {
    const existing = await this.prisma.spaCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: { select: { services: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Danh mục không tồn tại.');
    }

    if (existing.managerId && existing.managerId !== managerId) {
      throw new ForbiddenException('Bạn không có quyền xóa danh mục này.');
    }

    if (existing._count.services > 0) {
      throw new BadRequestException(`Không thể xóa danh mục đang chứa ${existing._count.services} dịch vụ!`);
    }

    return this.prisma.spaCategory.delete({
      where: { id: categoryId },
    });
  }

  async createManagerService(
    managerId: string,
    dto: {
      brandId?: string;
      categoryId?: string;
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
    const catId = dto.categoryId || dto.brandId;
    const category = await this.prisma.spaCategory.findFirst({
      where: {
        id: catId,
        OR: [
          { managerId },
          { managerId: null },
        ],
      },
    });
    if (!category) {
      throw new ForbiddenException('Danh mục Spa không tồn tại hoặc bạn không có quyền.');
    }

    return this.prisma.spaService.create({
      data: {
        categoryId: catId!,
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
      categoryId?: string;
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
      include: { category: true },
    });

    if (!service) {
      throw new NotFoundException('Dịch vụ không tồn tại.');
    }

    if (service.category.managerId && service.category.managerId !== managerId) {
      throw new ForbiddenException('Bạn không quản lý dịch vụ này.');
    }

    const data: any = {};
    const catId = dto.categoryId || dto.brandId;
    if (catId !== undefined) data.categoryId = catId;
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

    const targetBranch = (branchId && branchId !== 'ALL') ? branchId : undefined;

    const bookings = await this.prisma.spaBooking.findMany({
      where: targetBranch ? { addressSpaId: targetBranch } : {},
      include: {
        service: {
          select: { id: true, name: true, price: true, durationMin: true, description: true },
        },
        user: {
          select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
        },
        pet: true,
        staff: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Collect ALL service IDs (main + sub) for a single bulk query
    const allMainServiceIds = Array.from(
      new Set(bookings.map((b) => b.serviceId || b.mainServiceId).filter(Boolean))
    ) as string[];
    const allSubServiceIds = Array.from(
      new Set(bookings.flatMap((b) => b.subServiceIds || []))
    ) as string[];
    const allServiceIds = Array.from(new Set([...allMainServiceIds, ...allSubServiceIds]));

    const servicesList = allServiceIds.length > 0
      ? await this.prisma.spaService.findMany({
        where: { id: { in: allServiceIds } },
        select: { id: true, name: true, price: true, description: true, isMain: true },
      })
      : [];

    const servicesMap = new Map(servicesList.map((s) => [s.id, s]));

    const mappedBookings = bookings.map((b) => {
      const targetMainId = b.serviceId || b.mainServiceId;
      // Resolve main service: prefer Prisma include, fall back to bulk query
      const mainServiceResolved: any = b.service || (targetMainId ? servicesMap.get(targetMainId) : null);

      // Resolve sub-services from bulk query
      const resolvedSubServices = (b.subServiceIds || [])
        .map((id) => servicesMap.get(id))
        .filter(Boolean) as any[];

      // Use DB totalPrice (actual price paid), fall back to computed only if null
      const mainPrice = b.priceSnapshot || mainServiceResolved?.price || 0;
      const resolvedSubTotal = resolvedSubServices.reduce((sum, s) => sum + (s?.price || 0), 0);
      const totalPrice = b.totalPrice ?? Math.max(0, mainPrice + resolvedSubTotal - (b.discountAmount || 0));
      const subRevenue = Math.max(0, totalPrice - mainPrice - (b.discountAmount || 0));

      // Build sub-services display:
      // - If IDs resolved → show real services
      // - If not (old data) → create placeholder entries with distributed price
      let subServicesDisplay: any[] = resolvedSubServices;
      const subIds = b.subServiceIds || [];
      if (resolvedSubServices.length === 0 && subIds.length > 0) {
        const priceEach = subIds.length > 0 ? Math.round(subRevenue / subIds.length) : 0;
        subServicesDisplay = subIds.map((id, i) => ({
          id,
          name: `Dịch vụ lẻ #${i + 1}`,
          price: priceEach,
          isMain: false,
        }));
      }

      return {
        ...b,
        priceSnapshot: mainPrice,
        totalPrice,
        subServicesTotal: subRevenue,
        subServices: subServicesDisplay,
        mainServiceResolved,
      };
    });

    // Priority Sort: 1. PENDING (unconfirmed), 2. CONFIRMED without staff, 3. Reverse chronological by scheduledAt desc
    return mappedBookings.sort((a, b) => {
      const getPriority = (item: any) => {
        if (item.status === SpaBookingStatus.PENDING) return 1;
        if (item.status === SpaBookingStatus.CONFIRMED && !item.staffId) return 2;
        return 3;
      };

      const prioA = getPriority(a);
      const prioB = getPriority(b);

      if (prioA !== prioB) return prioA - prioB;
      return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
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
      where: {
        OR: [{ userId: newStaffId }, { id: newStaffId }],
        addressSpaId: booking.addressSpaId,
      },
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
        staffId: staff.userId,
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
      where: { addressSpaId: booking.addressSpaId, status: 'ACTIVE' },
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
      where: {
        OR: [{ userId: staffId }, { id: staffId }],
        addressSpaId: booking.addressSpaId,
      },
    });
    if (!staff) {
      throw new BadRequestException('Nhân viên không thuộc chi nhánh này.');
    }

    return this.prisma.spaBooking.update({
      where: { id: bookingId },
      data: {
        staffId: staff.userId,
        status: SpaBookingStatus.ASSIGNED,
      },
    });
  }

  async createManagerStaff(managerId: string, dto: CreateStaffDto) {
    const username = dto.username?.trim();
    const fullname = dto.fullname?.trim();
    const phone = dto.phone?.trim();
    const password = dto.password;

    if (!username || username.length < 3) {
      throw new BadRequestException('Tên đăng nhập phải có ít nhất 3 ký tự.');
    }

    if (!fullname || fullname.length < 2) {
      throw new BadRequestException('Họ và tên phải có ít nhất 2 ký tự.');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 6 ký tự.');
    }

    // Phone validation: starts with 0 and has exactly 10 digits
    const phoneRegex = /^0\d{9}$/;
    if (!phone || !phoneRegex.test(phone)) {
      throw new BadRequestException('Số điện thoại phải bắt đầu bằng số 0 và bao gồm đúng 10 chữ số (vd: 0912345678).');
    }

    // Check existing username or phone
    const existingUsername = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: `${username.toLowerCase()}@spa.local` },
        ],
      },
    });
    if (existingUsername) {
      throw new BadRequestException('Tên đăng nhập đã tồn tại trên hệ thống.');
    }

    // Find manager's branch
    let targetBranchId = dto.branchId;
    if (targetBranchId) {
      const branch = await this.prisma.addressSpa.findFirst({
        where: { id: targetBranchId, managerId },
      });
      if (!branch) {
        throw new ForbiddenException('Bạn không quản lý chi nhánh này.');
      }
    } else {
      const managerBranch = await this.prisma.addressSpa.findFirst({
        where: { managerId },
      });
      if (managerBranch) {
        targetBranchId = managerBranch.id;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const email = `${username.toLowerCase()}@spa.local`;

    const user = await this.prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email,
        passwordHash: hashedPassword,
        name: fullname,
        phone,
        role: UserRole.SPA_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        isVerified: true,
      },
    });

    const staffId = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const spaStaff = await this.prisma.spaStaff.create({
      data: {
        id: staffId,
        userId: user.id,
        addressSpaId: targetBranchId || null,
      },
    });

    return {
      id: spaStaff.id,
      userId: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      addressSpaId: spaStaff.addressSpaId,
    };
  }

  async getManagerStaffs(managerId: string, branchId: string) {
    await this.autoUpdateBookingStatuses();

    const targetBranch = (branchId && branchId !== 'ALL') ? branchId : undefined;

    const staffs = await this.prisma.spaStaff.findMany({
      where: targetBranch ? { addressSpaId: targetBranch } : {},
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
        ...(targetBranch ? { addressSpaId: targetBranch } : {}),
      },
      include: {
        service: {
          select: { price: true },
        },
        feedback: true,
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

      const ratedBookings = staffBookings.filter((b) => b.feedback && typeof b.feedback.rateStaff === 'number');
      const averageRating = ratedBookings.length > 0
        ? Math.round((ratedBookings.reduce((sum, b) => sum + (b.feedback?.rateStaff || 0), 0) / ratedBookings.length) * 10) / 10
        : 0;

      const onTimeBookings = completed.filter((b) => (b.completionDiffMinutes ?? 0) <= 0);
      const lateBookings = completed.filter((b) => (b.completionDiffMinutes ?? 0) > 0);
      const onTimeRate = completed.length > 0 ? Math.round((onTimeBookings.length / completed.length) * 100) : 100;
      const revenue = completed.reduce((sum, b) => sum + (b.totalPrice || b.priceSnapshot || b.service?.price || 0), 0);

      return {
        id: staff.id,
        userId: staff.userId,
        name: staff.user?.name || 'Nhân viên',
        email: staff.user?.email || '',
        avatarUrl: staff.user?.avatarUrl || null,
        status: staff.status || 'ACTIVE',
        completedCount: completed.length,
        activeCount: active.length,
        onTimeCount: onTimeBookings.length,
        lateCount: lateBookings.length,
        onTimeRate,
        revenue,
        averageRating,
        feedbackCount: ratedBookings.length,
      };
    });
  }

  async toggleStaffStatus(managerId: string, staffId: string) {
    const staff = await this.prisma.spaStaff.findUnique({
      where: { id: staffId },
    });
    if (!staff) {
      throw new NotFoundException('Nhân viên không tồn tại.');
    }
    const newStatus = staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.prisma.spaStaff.update({
      where: { id: staffId },
      data: { status: newStatus },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async getManagerFeedbacks(managerId: string, branchId?: string) {
    const targetBranch = (branchId && branchId !== 'ALL') ? branchId : undefined;

    const feedbacks = await this.prisma.spaFeedback.findMany({
      where: targetBranch ? { booking: { addressSpaId: targetBranch } } : {},
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        booking: {
          include: {
            service: true,
            pet: true,
            staff: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
            addressSpa: true,
          },
        },
      },
    });

    const allSubServiceIds = Array.from(
      new Set(feedbacks.flatMap((f) => f.booking?.subServiceIds || []))
    );

    const subServicesList =
      allSubServiceIds.length > 0
        ? await this.prisma.spaService.findMany({
          where: { id: { in: allSubServiceIds } },
          select: { id: true, name: true, price: true, description: true },
        })
        : [];

    const subServicesMap = new Map(subServicesList.map((s) => [s.id, s]));

    return feedbacks.map((f) => ({
      ...f,
      booking: f.booking ? {
        ...f.booking,
        subServices: (f.booking.subServiceIds || []).map((id) => subServicesMap.get(id)).filter(Boolean),
      } : null,
    }));
  }

  async getAvailability(branchId: string, dateStr: string, durationMin: number = 30) {
    await this.autoUpdateBookingStatuses();

    const staffs = await this.prisma.spaStaff.findMany({
      where: { addressSpaId: branchId, status: 'ACTIVE' },
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
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    ];

    const result = [];

    for (const timeStr of timeSlots) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const startMins = hours * 60 + minutes;
      const endMins = startMins + durationMin;

      // Filter out slots that start before 09:00 or end after 18:00
      const isValidOperatingHours = startMins >= 9 * 60 && endMins <= 18 * 60;

      // Hide time slot if it extends past 18:00
      if (!isValidOperatingHours) {
        continue;
      }

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

  async createFeedback(userId: string, bookingId: string, dto: CreateSpaFeedbackDto) {
    const booking = await this.prisma.spaBooking.findUnique({
      where: { id: bookingId },
      include: { feedback: true },
    });

    if (!booking) {
      throw new NotFoundException('Lịch hẹn không tồn tại.');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền đánh giá lịch hẹn này.');
    }

    if (booking.status !== SpaBookingStatus.COMPLETED) {
      throw new BadRequestException('Chỉ có thể đánh giá những đơn hàng ở trạng thái hoàn thành.');
    }

    if (booking.feedback) {
      throw new BadRequestException('Lịch hẹn này đã được đánh giá trước đó.');
    }

    const rateStaff = Math.min(5, Math.max(1, Number(dto.rateStaff) || 1));
    const rateServices = Math.min(5, Math.max(1, Number(dto.rateServices) || 1));

    const feedback = await this.prisma.spaFeedback.create({
      data: {
        bookingId,
        userId,
        rateStaff,
        rateServices,
        comment: dto.comment?.trim() || null,
      },
    });

    return feedback;
  }
}

function isStaffBusy(staffBookings: any[], candidateStart: Date, candidateEnd: Date): boolean {
  for (const b of staffBookings) {
    if (
      b.status === SpaBookingStatus.CANCELLED ||
      b.status === SpaBookingStatus.NO_SHOW
    ) {
      continue;
    }
    let start = new Date(b.timeStartExpected || b.scheduledAt);
    const duration = b.service ? (b.service.durationMax || b.service.durationMin || 30) : 30;
    let end = new Date(b.timeEndExpected || (start.getTime() + duration * 60 * 1000));

    if (b.status === SpaBookingStatus.IN_PROGRESS && b.timeStartReal) {
      start = new Date(b.timeStartReal);
      end = new Date(start.getTime() + duration * 60 * 1000);
    } else if (b.status === SpaBookingStatus.COMPLETED && b.timeEndReal) {
      end = new Date(b.timeEndReal);
    }

    if (start < candidateEnd && end > candidateStart) {
      return true; // Overlaps - staff is busy
    }
  }
  return false;
}

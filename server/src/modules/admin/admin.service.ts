import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  ApprovalStatus,
  ComplaintAction,
  ComplaintStatus,
  ComplaintType,
  DocumentStatus,
  DocumentType,
  OrderStatus,
  PetStatus,
  Prisma,
  UserRole,
  VerificationBadge,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GrantSpaManagerDto,
  HidePetDto,
  RevokeSpaManagerDto,
  RestorePetDto,
  ResolveComplaintDto,
  ReviewPetDocumentDto,
  UpdateAccountStatusDto,
  UpdateApprovalStatusDto,
  UpdateUserRoleDto,
} from './dto/admin-actions.dto';

type AdminActor = {
  id: string;
  name?: string;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [
      totalUsers,
      totalPets,
      verifiedPets,
      pendingPetDocuments,
      totalMatches,
      pendingMatchingReports,
      totalStores,
      activeStores,
      pendingStores,
      totalProducts,
      totalOrders,
      pendingStoreOrders,
      activeProducts,
      outOfStockProducts,
      pendingStoreComplaints,
      totalSpaBranches,
      activeSpaBranches,
      pendingSpaBranches,
      totalSpaServices,
      totalSpaBookings,
      pendingSpaComplaints,
      storeRevenue,
      spaRevenue,
      recentUsers,
      recentPets,
      recentDocuments,
      recentComplaints,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.pet.count(),
      this.prisma.pet.count({ where: { verificationBadge: VerificationBadge.VERIFIED } }),
      this.prisma.petDocument.count({ where: { status: DocumentStatus.PENDING } }),
      this.prisma.match.count(),
      this.prisma.petReport.count({ where: { isResolved: false } }),
      this.prisma.store.count(),
      this.prisma.store.count({ where: { status: ApprovalStatus.ACTIVE } }),
      this.prisma.store.count({ where: { status: ApprovalStatus.PENDING } }),
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.count({ where: { stock: 0 } }),
      this.prisma.complaint.count({
        where: { type: ComplaintType.STORE, status: ComplaintStatus.PENDING },
      }),
      this.prisma.addressSpa.count(),
      this.prisma.addressSpa.count({ where: { status: ApprovalStatus.ACTIVE } }),
      this.prisma.addressSpa.count({ where: { status: ApprovalStatus.PENDING } }),
      this.prisma.spaService.count(),
      this.prisma.spaBooking.count(),
      this.prisma.complaint.count({
        where: { type: ComplaintType.SPA, status: ComplaintStatus.PENDING },
      }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true } }),
      this.prisma.spaBooking.aggregate({ _sum: { priceSnapshot: true } }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      this.prisma.pet.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          species: true,
          verificationBadge: true,
          createdAt: true,
          owner: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.petDocument.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          pet: {
            select: {
              id: true,
              name: true,
              owner: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      this.prisma.complaint.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      stats: {
        users: { total: totalUsers },
        pets: { total: totalPets, verified: verifiedPets, pendingVerification: pendingPetDocuments },
        matching: { totalMatches, pendingReports: pendingMatchingReports },
        store: {
          totalStores,
          activeStores,
          pendingStores,
          totalProducts,
          totalOrders,
          pendingOrders: pendingStoreOrders,
          activeProducts,
          outOfStockProducts,
          pendingComplaints: pendingStoreComplaints,
          revenue: storeRevenue._sum.totalAmount ?? 0,
        },
        spa: {
          totalBranches: totalSpaBranches,
          activeBranches: activeSpaBranches,
          pendingBranches: pendingSpaBranches,
          totalServices: totalSpaServices,
          totalBookings: totalSpaBookings,
          pendingComplaints: pendingSpaComplaints,
          revenue: spaRevenue._sum.priceSnapshot ?? 0,
        },
      },
      recentActivities: {
        users: recentUsers,
        pets: recentPets,
        petDocuments: recentDocuments,
        complaints: recentComplaints,
      },
    };
  }

  getUsers(query: { role?: UserRole; accountStatus?: AccountStatus; search?: string }) {
    const where: Prisma.UserWhereInput = { role: { not: UserRole.ADMIN } };

    if (query.role === UserRole.ADMIN) {
      return [];
    }
    if (query.role) where.role = query.role;
    if (query.accountStatus) where.accountStatus = query.accountStatus;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        role: true,
        accountStatus: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { pets: true, orders: true } },
      },
    });
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        role: true,
        accountStatus: true,
        isVerified: true,
        createdAt: true,
        pets: { orderBy: { createdAt: 'desc' }, take: 10 },
        orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!user) throw new NotFoundException('User not found.');
    if (user.role === UserRole.ADMIN) throw new NotFoundException('User not found.');
    return user;
  }

  async updateUserRole(actor: AdminActor, userId: string, dto: UpdateUserRoleDto) {
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot assign ADMIN role from user management.');
    }

    const currentUser = await this.ensureManagedUser(userId);

    if (currentUser.role === UserRole.SPA_STAFF || dto.role === UserRole.SPA_STAFF) {
      throw new BadRequestException('Tài khoản nhân viên Spa chỉ được quản lý bởi Spa Manager.');
    }

    if (currentUser.role === UserRole.SPA_MANAGER || dto.role === UserRole.SPA_MANAGER) {
      throw new BadRequestException('Hãy sử dụng quy trình cấp hoặc thu hồi quyền Spa Manager.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: { id: true, email: true, name: true, role: true, accountStatus: true },
    });

    await this.audit(actor.id, 'ADMIN_UPDATE_USER_ROLE', 'User', userId, { role: dto.role });
    return user;
  }

  async updateAccountStatus(actor: AdminActor, userId: string, dto: UpdateAccountStatusDto) {
    await this.ensureManagedUser(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: dto.accountStatus },
      select: { id: true, email: true, name: true, role: true, accountStatus: true },
    });

    await this.audit(actor.id, 'ADMIN_UPDATE_ACCOUNT_STATUS', 'User', userId, {
      accountStatus: dto.accountStatus,
    });
    return user;
  }

  async grantSpaManager(actor: AdminActor, userId: string, dto: GrantSpaManagerDto) {
    const user = await this.ensureManagedUser(userId);
    if (user.role !== UserRole.USER) {
      throw new BadRequestException('Chỉ có thể cấp quyền Spa Manager cho tài khoản người dùng.');
    }

    const branchIds = [...new Set(dto.branchIds)];
    const branches = await this.prisma.addressSpa.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true, managerId: true },
    });

    if (branches.length !== branchIds.length) {
      throw new BadRequestException('Có chi nhánh Spa không tồn tại.');
    }

    const occupiedBranches = branches.filter((branch) => branch.managerId && branch.managerId !== userId);
    if (occupiedBranches.length && !dto.allowReassignment) {
      throw new BadRequestException(
        `Các chi nhánh đã có quản lý: ${occupiedBranches.map((branch) => branch.name).join(', ')}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const manager = await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.SPA_MANAGER, accountStatus: AccountStatus.ACTIVE },
        select: { id: true, name: true, email: true, role: true, accountStatus: true },
      });

      await tx.addressSpa.updateMany({
        where: { id: { in: branchIds } },
        data: { managerId: userId },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ADMIN_GRANT_SPA_MANAGER',
          targetType: 'User',
          targetId: userId,
          metadata: {
            branchIds,
            reassignedBranchIds: occupiedBranches.map((branch) => branch.id),
          },
        },
      });

      return manager;
    });
  }

  async revokeSpaManager(actor: AdminActor, userId: string, dto: RevokeSpaManagerDto) {
    const user = await this.ensureManagedUser(userId);
    if (user.role !== UserRole.SPA_MANAGER) {
      throw new BadRequestException('Tài khoản này không phải Spa Manager.');
    }

    let replacementManagerId: string | null = null;
    if (dto.mode === 'TRANSFER') {
      if (!dto.newManagerId || dto.newManagerId === userId) {
        throw new BadRequestException('Vui lòng chọn một Spa Manager khác để chuyển giao.');
      }

      const replacement = await this.prisma.user.findFirst({
        where: {
          id: dto.newManagerId,
          role: UserRole.SPA_MANAGER,
          accountStatus: AccountStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!replacement) {
        throw new BadRequestException('Spa Manager nhận chuyển giao không hợp lệ hoặc đang bị khóa.');
      }
      replacementManagerId = replacement.id;
    }

    const managedBranches = await this.prisma.addressSpa.findMany({
      where: { managerId: userId },
      select: { id: true, name: true },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.addressSpa.updateMany({
        where: { managerId: userId },
        data: { managerId: replacementManagerId },
      });

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.USER },
        select: { id: true, name: true, email: true, role: true, accountStatus: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ADMIN_REVOKE_SPA_MANAGER',
          targetType: 'User',
          targetId: userId,
          metadata: {
            mode: dto.mode,
            branchIds: managedBranches.map((branch) => branch.id),
            replacementManagerId,
          },
        },
      });

      return updatedUser;
    });
  }

  getPets(query: { verified?: string; status?: PetStatus; search?: string }) {
    const where: Prisma.PetWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.verified === 'true') where.verificationBadge = VerificationBadge.VERIFIED;
    if (query.verified === 'false') where.NOT = { verificationBadge: VerificationBadge.VERIFIED };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { breed: { contains: query.search, mode: 'insensitive' } },
        { owner: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.pet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, email: true, accountStatus: true } },
        _count: { select: { documents: true, sentMatchingRequests: true, receivedMatchingRequests: true } },
      },
    });
  }

  async getPet(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, accountStatus: true } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!pet) throw new NotFoundException('Pet not found.');
    const [lastHideAction, unresolvedReportCount] = await Promise.all([
      this.prisma.auditLog.findFirst({
        where: { action: 'ADMIN_HIDE_PET', targetType: 'Pet', targetId: id },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true, createdAt: true },
      }),
      this.prisma.petReport.count({ where: { petId: id, isResolved: false } }),
    ]);

    return { ...pet, lastHideAction, unresolvedReportCount };
  }

  async hidePet(actor: AdminActor, petId: string, dto: HidePetDto) {
    const currentPet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true, status: true, isActive: true, isAvailableForMatching: true },
    });

    if (!currentPet) throw new NotFoundException('Pet not found.');
    if (currentPet.status === PetStatus.HIDDEN) {
      throw new BadRequestException('Hồ sơ thú cưng đã được ẩn trước đó.');
    }
    if (currentPet.status === PetStatus.INACTIVE) {
      throw new BadRequestException('Không thể ẩn hồ sơ đã được chủ sở hữu ngừng hoạt động.');
    }

    return this.prisma.$transaction(async (tx) => {
      const pet = await tx.pet.update({
        where: { id: petId },
        data: { status: PetStatus.HIDDEN, isActive: false, isAvailableForMatching: false },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ADMIN_HIDE_PET',
          targetType: 'Pet',
          targetId: petId,
          metadata: {
            reason: dto.reason,
            note: dto.note ?? null,
            previousStatus: currentPet.status,
            previousIsActive: currentPet.isActive,
            previousMatchingAvailability: currentPet.isAvailableForMatching,
          },
        },
      });

      return pet;
    });
  }

  async restorePet(actor: AdminActor, petId: string, dto: RestorePetDto) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: { owner: { select: { accountStatus: true } } },
    });

    if (!pet) throw new NotFoundException('Pet not found.');
    if (pet.status !== PetStatus.HIDDEN) {
      throw new BadRequestException('Chỉ có thể khôi phục hồ sơ đang bị ẩn.');
    }
    if (pet.owner.accountStatus !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Không thể khôi phục vì tài khoản chủ sở hữu không hoạt động.');
    }

    const [unresolvedReportCount, lastHideAction] = await Promise.all([
      this.prisma.petReport.count({ where: { petId, isResolved: false } }),
      this.prisma.auditLog.findFirst({
        where: { action: 'ADMIN_HIDE_PET', targetType: 'Pet', targetId: petId },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      }),
    ]);

    if (unresolvedReportCount > 0) {
      throw new BadRequestException('Hãy xử lý toàn bộ báo cáo chưa giải quyết trước khi khôi phục hồ sơ.');
    }

    const hideMetadata = lastHideAction?.metadata as Prisma.JsonObject | null | undefined;
    if (hideMetadata?.reason === 'DOCUMENT_FRAUD') {
      const approvedDocumentCount = await this.prisma.petDocument.count({
        where: { petId, status: DocumentStatus.APPROVED },
      });
      if (approvedDocumentCount === 0) {
        throw new BadRequestException('Hồ sơ cần có ít nhất một giấy tờ đã được duyệt trước khi khôi phục.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const restoredPet = await tx.pet.update({
        where: { id: petId },
        data: { status: PetStatus.ACTIVE, isActive: true, isAvailableForMatching: false },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ADMIN_RESTORE_PET',
          targetType: 'Pet',
          targetId: petId,
          metadata: {
            reason: dto.reason,
            note: dto.note ?? null,
            previousStatus: pet.status,
            matchingAvailabilityReset: true,
          },
        },
      });

      return restoredPet;
    });
  }

  getPetDocuments(query: { status?: DocumentStatus }) {
    return this.prisma.petDocument.findMany({
      where: query.status
        ? { status: query.status }
        : { status: { in: [DocumentStatus.PENDING, DocumentStatus.REVIEWING, DocumentStatus.NEED_MORE_INFO] } },
      orderBy: { createdAt: 'desc' },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            verificationBadge: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  async reviewPetDocument(actor: AdminActor, documentId: string, dto: ReviewPetDocumentDto) {
    const allowedStatuses: DocumentStatus[] = [
      DocumentStatus.APPROVED,
      DocumentStatus.REJECTED,
      DocumentStatus.NEED_MORE_INFO,
    ];
    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException('Only APPROVED, REJECTED, or NEED_MORE_INFO are allowed.');
    }

    const document = await this.prisma.petDocument.update({
      where: { id: documentId },
      data: {
        status: dto.status,
        reviewerId: actor.id,
        reviewerName: actor.name,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
      },
      include: { pet: { include: { documents: true } } },
    });

    await this.refreshPetVerification(document.petId);
    await this.audit(actor.id, 'ADMIN_REVIEW_PET_DOCUMENT', 'PetDocument', documentId, {
      status: dto.status,
    });

    return this.prisma.petDocument.findUnique({
      where: { id: documentId },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            verificationBadge: true,
            vaccineVerified: true,
            pedigreeVerified: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  getMatchingReports() {
    return this.prisma.petReport.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveMatchingReport(actor: AdminActor, reportId: string) {
    const report = await this.prisma.petReport.update({
      where: { id: reportId },
      data: { isResolved: true },
    });
    await this.audit(actor.id, 'ADMIN_RESOLVE_MATCHING_REPORT', 'PetReport', reportId);
    return report;
  }

  async getStores(_query: { status?: ApprovalStatus }) {
    const [store, totalProducts, totalOrders] = await this.prisma.$transaction([
      this.prisma.store.findFirst({
        orderBy: { createdAt: 'asc' },
        include: {
          manager: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      this.prisma.product.count(),
      this.prisma.order.count(),
    ]);

    return store
      ? [{ ...store, _count: { products: totalProducts, orders: totalOrders } }]
      : [];
  }

  getStoreProducts(storeId?: string) {
    return this.prisma.product.findMany({
      where: storeId ? { storeId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { store: { select: { id: true, name: true, status: true } } },
    });
  }

  getStoreOrders(storeId?: string) {
    return this.prisma.order.findMany({
      where: storeId ? { storeId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        store: { select: { id: true, name: true, status: true } },
        items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
      },
    });
  }

  getSpaBranches(query: { status?: ApprovalStatus }) {
    return this.prisma.addressSpa.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { staffs: true, bookings: true } },
      },
    });
  }

  async updateStoreSettings(
    actor: AdminActor,
    dto: { name: string; phone?: string; address?: string; description?: string },
  ) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Tên cửa hàng không được để trống.');
    }

    const currentStore = await this.prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });
    const store = currentStore
      ? await this.prisma.store.update({
          where: { id: currentStore.id },
          data: {
            name: dto.name.trim(),
            phone: dto.phone?.trim() || null,
            address: dto.address?.trim() || null,
            description: dto.description?.trim() || null,
          },
        })
      : await this.prisma.store.create({
          data: {
            id: 'petmatching_main_store',
            name: dto.name.trim(),
            phone: dto.phone?.trim() || null,
            address: dto.address?.trim() || null,
            description: dto.description?.trim() || null,
            status: ApprovalStatus.ACTIVE,
          },
        });

    await this.audit(actor.id, 'ADMIN_UPDATE_STORE_SETTINGS', 'Store', store.id);
    return store;
  }

  async updateSpaBranchStatus(actor: AdminActor, branchId: string, dto: UpdateApprovalStatusDto) {
    const branch = await this.prisma.addressSpa.update({
      where: { id: branchId },
      data: { status: dto.status },
    });

    await this.audit(actor.id, 'ADMIN_UPDATE_SPA_BRANCH_STATUS', 'AddressSpa', branchId, {
      status: dto.status,
    });

    return branch;
  }

  getSpaBookings(brandId?: string) {
    return this.prisma.spaBooking.findMany({
      where: brandId ? { brandId } : undefined,
      orderBy: { scheduledAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        staff: { select: { id: true, name: true, email: true } },
        brand: { select: { id: true, name: true, status: true } },
        service: { select: { id: true, name: true, price: true, durationMin: true } },
      },
    });
  }

  getComplaints(query: { type?: ComplaintType; status?: ComplaintStatus }) {
    return this.prisma.complaint.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveComplaint(actor: AdminActor, complaintId: string, dto: ResolveComplaintDto) {
    const status = this.mapComplaintStatus(dto.action);
    const complaint = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status,
        actionTaken: dto.action,
        adminNote: dto.adminNote,
        resolvedById: actor.id,
        resolvedAt: new Date(),
      },
    });

    await this.audit(actor.id, 'ADMIN_RESOLVE_COMPLAINT', 'Complaint', complaintId, {
      action: dto.action,
    });
    return complaint;
  }

  private async refreshPetVerification(petId: string) {
    const [approvedDocuments, pendingDocuments, approvedVaccineDocuments, approvedPedigreeDocuments] =
      await Promise.all([
        this.prisma.petDocument.count({
          where: { petId, status: DocumentStatus.APPROVED },
        }),
        this.prisma.petDocument.count({
          where: { petId, status: { in: [DocumentStatus.PENDING, DocumentStatus.REVIEWING, DocumentStatus.NEED_MORE_INFO] } },
        }),
        this.prisma.petDocument.count({
          where: { petId, type: DocumentType.VACCINE_RECORD, status: DocumentStatus.APPROVED },
        }),
        this.prisma.petDocument.count({
          where: { petId, type: DocumentType.PEDIGREE_CERT, status: DocumentStatus.APPROVED },
        }),
      ]);

    const data: Prisma.PetUpdateInput = {
      verificationBadge:
        approvedDocuments > 0
          ? VerificationBadge.VERIFIED
          : pendingDocuments > 0
            ? VerificationBadge.PENDING
            : VerificationBadge.NONE,
      vaccineVerified: approvedVaccineDocuments > 0,
      pedigreeVerified: approvedPedigreeDocuments > 0,
    };

    await this.prisma.pet.update({ where: { id: petId }, data });
  }

  private mapComplaintStatus(action: ComplaintAction) {
    if (action === ComplaintAction.DISMISS) return ComplaintStatus.DISMISSED;
    if (action === ComplaintAction.ESCALATE) return ComplaintStatus.ESCALATED;
    return ComplaintStatus.RESOLVED;
  }

  private async ensureManagedUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) throw new NotFoundException('User not found.');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin accounts cannot be managed here.');
    }

    return user;
  }

  private audit(actorId: string | undefined, action: string, targetType: string, targetId?: string, metadata?: object) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
  }
}

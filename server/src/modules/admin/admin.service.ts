import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  ApprovalStatus,
  ComplaintAction,
  ComplaintStatus,
  ComplaintType,
  DocumentStatus,
  DocumentType,
  PetStatus,
  Prisma,
  UserRole,
  VerificationBadge,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateComplaintDto,
  ResolveComplaintDto,
  ReviewPetDocumentDto,
  UpdateAccountStatusDto,
  UpdateApprovalStatusDto,
  UpdateUserRoleDto,
  UpsertSettingDto,
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
      this.prisma.complaint.count({
        where: { type: ComplaintType.STORE, status: ComplaintStatus.PENDING },
      }),
      this.prisma.spaBrand.count(),
      this.prisma.spaBrand.count({ where: { status: ApprovalStatus.ACTIVE } }),
      this.prisma.spaBrand.count({ where: { status: ApprovalStatus.PENDING } }),
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

    await this.ensureManagedUser(userId);

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
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { documents: true, sentMatchingRequests: true, receivedMatchingRequests: true } },
      },
    });
  }

  async getPet(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!pet) throw new NotFoundException('Pet not found.');
    return pet;
  }

  async hidePet(actor: AdminActor, petId: string) {
    const pet = await this.prisma.pet.update({
      where: { id: petId },
      data: { status: PetStatus.HIDDEN, isActive: false, isAvailableForMatching: false },
    });
    await this.audit(actor.id, 'ADMIN_HIDE_PET', 'Pet', petId);
    return pet;
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

  getStores(query: { status?: ApprovalStatus }) {
    return this.prisma.store.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
  }

  updateStoreStatus(actor: AdminActor, storeId: string, dto: UpdateApprovalStatusDto) {
    return this.updateApprovalStatus(actor, 'Store', storeId, dto.status);
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
    return this.prisma.spaBrand.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { services: true, bookings: true } },
      },
    });
  }

  updateSpaBranchStatus(actor: AdminActor, branchId: string, dto: UpdateApprovalStatusDto) {
    return this.updateApprovalStatus(actor, 'SpaBrand', branchId, dto.status);
  }

  getSpaServices(brandId?: string) {
    return this.prisma.spaService.findMany({
      where: brandId ? { brandId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { brand: { select: { id: true, name: true, status: true } } },
    });
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

  createComplaint(actor: AdminActor, dto: CreateComplaintDto) {
    return this.prisma.complaint.create({
      data: {
        ...dto,
      },
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

  async getAnalytics() {
    const [usersByRole, ordersByStatus, bookingsByStatus, documentsByStatus, complaintsByStatus] =
      await this.prisma.$transaction([
        this.prisma.user.groupBy({ by: ['role'], orderBy: { role: 'asc' }, _count: { _all: true } }),
        this.prisma.order.groupBy({
          by: ['status'],
          orderBy: { status: 'asc' },
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.spaBooking.groupBy({
          by: ['status'],
          orderBy: { status: 'asc' },
          _count: { _all: true },
          _sum: { priceSnapshot: true },
        }),
        this.prisma.petDocument.groupBy({
          by: ['status'],
          orderBy: { status: 'asc' },
          _count: { _all: true },
        }),
        this.prisma.complaint.groupBy({
          by: ['status'],
          orderBy: { status: 'asc' },
          _count: { _all: true },
        }),
      ]);

    return {
      usersByRole,
      ordersByStatus,
      bookingsByStatus,
      documentsByStatus,
      complaintsByStatus,
    };
  }

  getSettings() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertSetting(actor: AdminActor, dto: UpsertSettingDto) {
    let value: Prisma.InputJsonValue;
    try {
      value = JSON.parse(dto.value) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException('Setting value must be valid JSON.');
    }

    const setting = await this.prisma.systemSetting.upsert({
      where: { key: dto.key },
      create: { key: dto.key, value },
      update: { value },
    });

    await this.audit(actor.id, 'ADMIN_UPSERT_SETTING', 'SystemSetting', setting.id, {
      key: dto.key,
    });
    return setting;
  }

  getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    });
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

  private async updateApprovalStatus(
    actor: AdminActor,
    targetType: 'Store' | 'SpaBrand',
    targetId: string,
    status: ApprovalStatus,
  ) {
    const data = {
      status,
      approvedAt: status === ApprovalStatus.ACTIVE ? new Date() : undefined,
      suspendedAt: status === ApprovalStatus.SUSPENDED ? new Date() : undefined,
    };

    const result =
      targetType === 'Store'
        ? await this.prisma.store.update({ where: { id: targetId }, data })
        : await this.prisma.spaBrand.update({ where: { id: targetId }, data });

    await this.audit(actor.id, `ADMIN_UPDATE_${targetType.toUpperCase()}_STATUS`, targetType, targetId, {
      status,
    });
    return result;
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

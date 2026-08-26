import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BreedRule,
  Gender,
  MatchStatus,
  MatchingRequestStatus,
  NotificationCategory,
  NotificationEventType,
  Pet,
  PetStatus,
  Prisma,
  Species,
  VerificationBadge,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { CreateMatchingRequestDto } from './dto/create-matching-request.dto';
import { EndMatchDto } from './dto/end-match.dto';
import { GetCandidatesDto } from './dto/get-candidates.dto';
import { PassPetDto } from './dto/pass-pet.dto';
import {
  MATCH_REPORT_REASONS_BY_TARGET,
  ReportMatchDto,
} from './dto/report-match.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { getProvinceCoords } from './province-coordinates';
import { getHanoiWardCoords } from './hanoi-wards';

type PetWithOwner = Pet & {
  owner: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

interface CompatibilityResult {
  score: number;
  reasons: string[];
  warnings: string[];
  breedInfo?: {
    offspringName: string | null;
    warningNote: string | null;
    isCompatible: boolean;
  };
}

const matchParticipantInclude = Prisma.validator<Prisma.MatchInclude>()({
  pet1: {
    include: { owner: { select: { id: true, name: true, email: true } } },
  },
  pet2: {
    include: { owner: { select: { id: true, name: true, email: true } } },
  },
});

const matchActionSelect = Prisma.validator<Prisma.MatchSelect>()({
  id: true,
  status: true,
  endedAt: true,
  endReason: true,
});

type MatchWithParticipants = Prisma.MatchGetPayload<{
  include: typeof matchParticipantInclude;
}>;

// Tuổi tối thiểu cho phối giống (tháng)
const MIN_AGE_MONTHS = { DOG: 12, CAT: 8 } as const;

const CHAT_ENABLED_MATCH_STATUSES: MatchStatus[] = [MatchStatus.ACTIVE];

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

@Injectable()
export class MatchingService {
  constructor(
    private prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly notifications: NotificationsService,
  ) {}

  async getCandidates(userId: string, dto: GetCandidatesDto) {
    const femalePet = await this.getOwnedFemalePet(userId, dto.femalePetId);
    const blockedUserIds = await this.getBlockedUserIds(userId);

    // --- Hard constraint: tuổi tối thiểu cho query ---
    const minAgeDate = new Date();
    const minMonths = MIN_AGE_MONTHS[femalePet.species];
    minAgeDate.setMonth(minAgeDate.getMonth() - minMonths);

    const where: Prisma.PetWhereInput = {
      species: femalePet.species,
      gender: Gender.MALE,
      status: PetStatus.ACTIVE,
      isAvailableForMatching: true,
      ownerId: { notIn: [userId, ...blockedUserIds] },
      // Hard constraint: chỉ lấy pet đủ tuổi
      birthday: { lte: minAgeDate },
    };

    if (dto.breed && dto.breed !== 'all') {
      where.breed = dto.breed;
    }
    if (dto.location && dto.location !== 'all') {
      where.location = dto.location;
    }
    if (dto.weightMin || dto.weightMax) {
      where.weight = {
        gte: dto.weightMin ? Number(dto.weightMin) : undefined,
        lte: dto.weightMax ? Number(dto.weightMax) : undefined,
      };
    }
    if (dto.verifiedOnly === 'true') {
      where.verificationBadge = VerificationBadge.VERIFIED;
    }
    if (dto.hasPedigreeOnly === 'true') {
      where.hasPedigree = true;
    }

    const candidates = await this.prisma.pet.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [
        { verificationBadge: 'desc' },
        { pedigreeVerified: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: 100,
    });

    const candidateIds = candidates.map((candidate) => candidate.id);

    const [history, activeMatches] = await Promise.all([
      this.prisma.matchingRequest.findMany({
        where: {
          femalePetId: femalePet.id,
          malePetId: { in: candidateIds },
          status: {
            in: [
              MatchingRequestStatus.PENDING,
              MatchingRequestStatus.ACCEPTED,
              MatchingRequestStatus.REJECTED,
              MatchingRequestStatus.PASSED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.match.findMany({
        where: {
          status: MatchStatus.ACTIVE,
          OR: [
            { pet1Id: femalePet.id, pet2Id: { in: candidateIds } },
            { pet2Id: femalePet.id, pet1Id: { in: candidateIds } },
          ],
        },
        select: { pet1Id: true, pet2Id: true },
      }),
    ]);

    const activeMatchedPetIds = new Set(
      activeMatches
        .flatMap((m) => [m.pet1Id, m.pet2Id])
        .filter((id) => id !== femalePet.id),
    );

    const latestByMalePetId = new Map(
      history.map((item) => [item.malePetId, item]),
    );

    // Filter candidates và tính compatibility score (async)
    const eligibleCandidates = candidates.filter((candidate) => {
      // 1. Nếu đang có Match ACTIVE (phòng chat đang hoạt động) -> Chặn tuyệt đối
      if (activeMatchedPetIds.has(candidate.id)) {
        return false;
      }

      const latest = latestByMalePetId.get(candidate.id);
      if (!latest) return true;

      // 2. Yêu cầu đang PENDING (đang chờ duyệt) hoặc ACCEPTED (đã ghép đôi) -> Không hiển thị lại
      if (
        latest.status === MatchingRequestStatus.PENDING ||
        latest.status === MatchingRequestStatus.ACCEPTED
      ) {
        return false;
      }

      // 3. Đối với yêu cầu REJECTED hoặc PASSED: Chỉ hiển thị lại nếu một trong 2 pet có cập nhật hồ sơ sau thời điểm phản hồi
      const requestTimestamp = latest.respondedAt || latest.createdAt;
      const latestProfileUpdate =
        femalePet.updatedAt > candidate.updatedAt
          ? femalePet.updatedAt
          : candidate.updatedAt;

      return requestTimestamp < latestProfileUpdate;
    });

    // Batch fetch breed rules để tránh N+1 DB query lên Supabase
    const breedRules = await this.prisma.breedRule.findMany({
      where: { species: femalePet.species, isActive: true },
    });

    const maxDist = dto.maxDistanceKm ? Number(dto.maxDistanceKm) : 0;

    // Tính compatibility scores & distanceKm đồng bộ trong bộ nhớ
    let data = eligibleCandidates.map((candidate) => {
      const compatibility = this.calculateCompatibilityScoreSync(
        femalePet,
        candidate,
        breedRules,
      );

      let distanceKm = 10;
      let femaleLat = femalePet.latitude;
      let femaleLng = femalePet.longitude;
      let candLat = candidate.latitude;
      let candLng = candidate.longitude;

      // Tra cứu fallback theo Phường Hà Nội nếu thiếu toạ độ GPS
      if (femaleLat == null || femaleLng == null) {
        const fWardCoords = getHanoiWardCoords(femalePet.ward || femalePet.location);
        femaleLat = fWardCoords.lat;
        femaleLng = fWardCoords.lng;
      }
      if (candLat == null || candLng == null) {
        const cWardCoords = getHanoiWardCoords(candidate.ward || candidate.location);
        candLat = cWardCoords.lat;
        candLng = cWardCoords.lng;
      }

      // Kiểm tra cùng Phường / Xã
      const isSameWard =
        femalePet.ward &&
        candidate.ward &&
        femalePet.ward.trim().toLowerCase() === candidate.ward.trim().toLowerCase();

      if (isSameWard) {
        distanceKm = 0.8;
      } else if (femaleLat != null && femaleLng != null && candLat != null && candLng != null) {
        distanceKm = calculateHaversineDistance(femaleLat, femaleLng, candLat, candLng);
      } else {
        distanceKm = 5.0;
      }

      return {
        ...this.toPetCard(candidate),
        compatibilityScore: compatibility.score,
        matchReasons: compatibility.reasons,
        breedWarnings: compatibility.warnings,
        breedInfo: compatibility.breedInfo,
        distanceKm,
      };
    });

    // Lọc theo bán kính maxDistanceKm (nếu được truyền lên)
    if (maxDist > 0) {
      data = data.filter((item) => item.distanceKm <= maxDist);
    }

    // Sắp xếp theo điểm giảm dần
    data.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    return { data };
  }

  async passPet(userId: string, dto: PassPetDto) {
    const femalePet = await this.getOwnedFemalePet(userId, dto.femalePetId);
    const malePet = await this.getMaleCandidate(dto.malePetId);
    this.ensureDifferentOwners(femalePet, malePet);
    const request = await this.prisma.$transaction(async (tx) => {
      await this.lockUserPair(tx, userId, malePet.ownerId);
      await this.ensureNoUserBlock(tx, userId, malePet.ownerId);
      return tx.matchingRequest.create({
        data: {
          requesterId: userId,
          femalePetId: femalePet.id,
          malePetId: malePet.id,
          status: MatchingRequestStatus.PASSED,
        },
      });
    });

    return { success: true, request };
  }

  async createRequest(userId: string, dto: CreateMatchingRequestDto) {
    const femalePet = await this.getOwnedFemalePet(userId, dto.femalePetId);
    const malePet = await this.getMaleCandidate(dto.malePetId);
    this.ensureDifferentOwners(femalePet, malePet);

    // --- Hard constraint: kiểm tra tuổi cả hai bên ---
    this.assertMinimumAge(femalePet);
    this.assertMinimumAge(malePet);

    const request = await this.prisma.$transaction(async (tx) => {
      await this.lockUserPair(tx, userId, malePet.ownerId);
      await this.ensureNoUserBlock(tx, userId, malePet.ownerId);
      const existingPending = await tx.matchingRequest.findFirst({
        where: {
          femalePetId: femalePet.id,
          malePetId: malePet.id,
          status: MatchingRequestStatus.PENDING,
        },
        select: { id: true },
      });
      if (existingPending) {
        throw new ConflictException(
          'A pending request already exists for this pair.',
        );
      }

      const createdRequest = await tx.matchingRequest.create({
        data: {
          requesterId: userId,
          femalePetId: femalePet.id,
          malePetId: malePet.id,
          note: dto.note,
          status: MatchingRequestStatus.PENDING,
        },
        include: this.requestInclude(),
      });
      await this.notifications.create(
        {
          userId: malePet.ownerId,
          category: NotificationCategory.MATCHING,
          eventType: NotificationEventType.MATCH_REQUEST_CREATED,
          title: 'Yêu cầu ghép đôi mới',
          content: `${femalePet.name} đã gửi yêu cầu ghép đôi với ${malePet.name}.`,
          targetUrl: '/requests',
          entityType: 'MATCHING_REQUEST',
          entityId: createdRequest.id,
        },
        tx,
      );
      return createdRequest;
    });

    return { success: true, request };
  }

  async getIncomingRequests(userId: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    return this.prisma.matchingRequest.findMany({
      where: {
        status: MatchingRequestStatus.PENDING,
        malePet: { ownerId: userId },
        femalePet: { ownerId: { notIn: blockedUserIds } },
      },
      include: this.requestInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOutgoingRequests(userId: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    return this.prisma.matchingRequest.findMany({
      where: {
        requesterId: userId,
        malePet: { ownerId: { notIn: blockedUserIds } },
        status: {
          not: MatchingRequestStatus.PASSED,
        },
      },
      include: this.requestInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptRequest(userId: string, requestId: string) {
    const request = await this.getPendingOwnedIncomingRequest(
      userId,
      requestId,
    );
    const [pet1Id, pet2Id] = [request.femalePetId, request.malePetId].sort();

    const compatibility = await this.calculateCompatibilityScore(
      request.femalePet,
      request.malePet,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUserPair(
        tx,
        request.femalePet.ownerId,
        request.malePet.ownerId,
      );
      await this.ensureNoUserBlock(
        tx,
        request.femalePet.ownerId,
        request.malePet.ownerId,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "matching_requests" WHERE "id" = ${requestId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "pets" WHERE "id" = ${pet1Id} OR "id" = ${pet2Id} ORDER BY "id" FOR UPDATE`,
      );
      const currentRequest = await tx.matchingRequest.findUnique({
        where: { id: requestId },
        select: {
          status: true,
          femalePet: { select: { status: true } },
          malePet: { select: { status: true } },
        },
      });
      if (currentRequest?.status !== MatchingRequestStatus.PENDING) {
        throw new BadRequestException('Only pending requests can be updated.');
      }
      if (
        currentRequest.femalePet.status !== PetStatus.ACTIVE ||
        currentRequest.malePet.status !== PetStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Không thể ghép đôi vì một thú cưng đang bị ẩn hoặc ngừng hoạt động.',
        );
      }
      const updatedRequest = await tx.matchingRequest.update({
        where: { id: requestId },
        data: {
          status: MatchingRequestStatus.ACCEPTED,
          respondedAt: new Date(),
        },
        include: this.requestInclude(),
      });

      const match = await tx.match.upsert({
        where: { pet1Id_pet2Id: { pet1Id, pet2Id } },
        update: {
          status: MatchStatus.ACTIVE,
          endedAt: null,
          endedById: null,
          endReason: null,
        },
        create: {
          pet1Id,
          pet2Id,
          status: MatchStatus.ACTIVE,
          compatibilityScore: compatibility.score,
          matchReasons: compatibility.reasons,
        },
        include: {
          pet1: true,
          pet2: true,
        },
      });

      await this.notifications.create(
        {
          userId: request.requesterId,
          category: NotificationCategory.MATCHING,
          eventType: NotificationEventType.MATCH_REQUEST_ACCEPTED,
          title: 'Yêu cầu ghép đôi đã được chấp nhận',
          content: `${request.malePet.name} đã chấp nhận yêu cầu ghép đôi với ${request.femalePet.name}.`,
          targetUrl: `/messages?matchId=${match.id}`,
          entityType: 'MATCHING_REQUEST',
          entityId: requestId,
        },
        tx,
      );

      return { request: updatedRequest, match };
    });

    return { success: true, ...result };
  }

  async rejectRequest(userId: string, requestId: string) {
    const pendingRequest = await this.getPendingOwnedIncomingRequest(
      userId,
      requestId,
    );
    const request = await this.prisma.$transaction(async (tx) => {
      await this.lockUserPair(
        tx,
        pendingRequest.femalePet.ownerId,
        pendingRequest.malePet.ownerId,
      );
      await this.ensureNoUserBlock(
        tx,
        pendingRequest.femalePet.ownerId,
        pendingRequest.malePet.ownerId,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "matching_requests" WHERE "id" = ${requestId} FOR UPDATE`,
      );
      const currentRequest = await tx.matchingRequest.findUnique({
        where: { id: requestId },
        select: { status: true },
      });
      if (currentRequest?.status !== MatchingRequestStatus.PENDING) {
        throw new BadRequestException('Only pending requests can be updated.');
      }
      const rejectedRequest = await tx.matchingRequest.update({
        where: { id: requestId },
        data: {
          status: MatchingRequestStatus.REJECTED,
          respondedAt: new Date(),
        },
        include: this.requestInclude(),
      });
      await this.notifications.create(
        {
          userId: pendingRequest.requesterId,
          category: NotificationCategory.MATCHING,
          eventType: NotificationEventType.MATCH_REQUEST_REJECTED,
          title: 'Yêu cầu ghép đôi bị từ chối',
          content: `Yêu cầu ghép đôi ${pendingRequest.femalePet.name} với ${pendingRequest.malePet.name} đã bị từ chối.`,
          targetUrl: '/requests',
          entityType: 'MATCHING_REQUEST',
          entityId: requestId,
        },
        tx,
      );
      return rejectedRequest;
    });

    return { success: true, request };
  }

  async getMatches(userId: string) {
    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ pet1: { ownerId: userId } }, { pet2: { ownerId: userId } }],
      },
      include: {
        pet1: {
          include: {
            owner: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        pet2: {
          include: {
            owner: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, name: true } } },
        },
        _count: {
          select: {
            messages: { where: { senderId: { not: userId }, isRead: false } },
          },
        },
        reports: {
          where: { userId },
          select: { targetType: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const blocks = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    });

    return matches.map(({ reports, ...match }) => {
      const otherUserId =
        match.pet1.ownerId === userId
          ? match.pet2.ownerId
          : match.pet1.ownerId;
      return {
        ...match,
        reportedTargetTypes: reports.map((report) => report.targetType),
        blockedByMe: blocks.some(
          (block) => block.blockedId === otherUserId,
        ),
      };
    });
  }

  async reportMatch(userId: string, matchId: string, dto: ReportMatchDto) {
    const allowedReasons = MATCH_REPORT_REASONS_BY_TARGET[dto.targetType];
    if (!(allowedReasons as readonly string[]).includes(dto.reason)) {
      throw new BadRequestException(
        'Lý do báo cáo không phù hợp với đối tượng đã chọn.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const match = await this.getLockedMatch(tx, matchId);
        const participant = this.getParticipantContext(match, userId);
        const detail = dto.detail?.trim() || null;

        const existingReport = await tx.petReport.findUnique({
          where: {
            matchId_userId_targetType: {
              matchId,
              userId,
              targetType: dto.targetType,
            },
          },
          select: { id: true },
        });
        if (existingReport) {
          throw new ConflictException(
            `Bạn đã báo cáo ${dto.targetType === 'USER' ? 'người dùng' : 'thú cưng'} này trong match này.`,
          );
        }

        const reportedPetId =
          participant.side === 'pet1' ? match.pet2Id : match.pet1Id;
        const report = await tx.petReport.create({
          data: {
            matchId,
            userId,
            reportedUserId: participant.otherOwner.id,
            petId: reportedPetId,
            targetType: dto.targetType,
            reason: dto.reason,
            detail,
          },
          select: {
            id: true,
            targetType: true,
            reason: true,
            detail: true,
            createdAt: true,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'USER_CREATE_MATCHING_REPORT',
            targetType: 'PetReport',
            targetId: report.id,
            metadata: {
              matchId,
              targetType: dto.targetType,
              reportedUserId: participant.otherOwner.id,
              reportedPetId,
            },
          },
        });

        await this.notifications.create(
          {
            userId,
            category: NotificationCategory.SYSTEM,
            eventType: NotificationEventType.SYSTEM,
            title: 'PetMatch đã tiếp nhận phản ánh',
            content:
              'Phản ánh của bạn đã được ghi nhận. PetMatch sẽ thông báo ngay khi có kết quả xử lý.',
            targetUrl: '/notifications',
            entityType: 'PET_REPORT',
            entityId: report.id,
          },
          tx,
        );

        return { success: true, report };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Bạn đã báo cáo ${dto.targetType === 'USER' ? 'người dùng' : 'thú cưng'} này trong match này.`,
        );
      }
      throw error;
    }
  }

  async blockMatchUser(userId: string, matchId: string) {
    const sourceMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: matchParticipantInclude,
    });
    if (!sourceMatch) throw new NotFoundException('Không tìm thấy match.');
    const sourceParticipant = this.getParticipantContext(sourceMatch, userId);

    return this.prisma.$transaction(async (tx) => {
      await this.lockUserPair(tx, userId, sourceParticipant.otherOwner.id);
      const match = await this.getLockedMatch(tx, matchId);
      const participant = this.getParticipantContext(match, userId);
      const blockedUserId = participant.otherOwner.id;
      const inserted = await tx.userBlock.createMany({
        data: [{ blockerId: userId, blockedId: blockedUserId }],
        skipDuplicates: true,
      });

      if (inserted.count === 0) {
        return { success: true, blockedUserId, alreadyBlocked: true };
      }

      const now = new Date();
      const ownerPairs = [
        {
          femalePet: { ownerId: userId },
          malePet: { ownerId: blockedUserId },
        },
        {
          femalePet: { ownerId: blockedUserId },
          malePet: { ownerId: userId },
        },
      ];
      const requestResult = await tx.matchingRequest.updateMany({
        where: {
          status: MatchingRequestStatus.PENDING,
          OR: ownerPairs,
        },
        data: { status: MatchingRequestStatus.CANCELLED, respondedAt: now },
      });
      const matchResult = await tx.match.updateMany({
        where: {
          status: { not: MatchStatus.CANCELLED },
          OR: [
            {
              pet1: { ownerId: userId },
              pet2: { ownerId: blockedUserId },
            },
            {
              pet1: { ownerId: blockedUserId },
              pet2: { ownerId: userId },
            },
          ],
        },
        data: {
          status: MatchStatus.CANCELLED,
          endedAt: now,
          endedById: userId,
          endReason: 'USER_BLOCKED',
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'USER_BLOCK',
          targetType: 'User',
          targetId: blockedUserId,
          metadata: {
            sourceMatchId: matchId,
            cancelledRequests: requestResult.count,
            cancelledMatches: matchResult.count,
          },
        },
      });

      return { success: true, blockedUserId, alreadyBlocked: false };
    });
  }

  getBlockedUsers(userId: string) {
    return this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      select: {
        createdAt: true,
        blocked: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unblockUser(userId: string, blockedUserId: string) {
    if (userId === blockedUserId) {
      throw new BadRequestException('Bạn không thể bỏ chặn chính mình.');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUserPair(tx, userId, blockedUserId);
      const deleted = await tx.userBlock.deleteMany({
        where: { blockerId: userId, blockedId: blockedUserId },
      });
      if (deleted.count > 0) {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'USER_UNBLOCK',
            targetType: 'User',
            targetId: blockedUserId,
          },
        });
      }
      return deleted.count;
    });

    return { success: true, blockedUserId, wasBlocked: result > 0 };
  }

  async endMatch(userId: string, matchId: string, dto: EndMatchDto) {
    const reason = dto.reason?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const match = await this.getLockedMatch(tx, matchId);
      this.getParticipantContext(match, userId);

      if (match.status === MatchStatus.CANCELLED) {
        throw new ConflictException('Match đã kết thúc trước đó.');
      }

      const endedAt = new Date();
      const previousStatus = match.status;
      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.CANCELLED,
          endedAt,
          endedById: userId,
          endReason: reason,
        },
        select: matchActionSelect,
      });
      await tx.pet.updateMany({
        where: { id: { in: [match.pet1Id, match.pet2Id] } },
        data: { updatedAt: endedAt },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'MATCH_END',
          targetType: 'Match',
          targetId: matchId,
          metadata: { previousStatus, reason },
        },
      });

      return updatedMatch;
    });
  }

  async getMessages(userId: string, matchId: string) {
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ pet1: { ownerId: userId } }, { pet2: { ownerId: userId } }],
      },
      select: {
        messages: {
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!match) {
      throw new NotFoundException('Active match not found.');
    }

    const hasUnreadMessages = match.messages.some(
      (message) => message.senderId !== userId && !message.isRead,
    );
    if (hasUnreadMessages) {
      await this.prisma.message.updateMany({
        where: { matchId, senderId: { not: userId }, isRead: false },
        data: { isRead: true },
      });
    }

    return match.messages.map((message) =>
      message.senderId === userId ? message : { ...message, isRead: true },
    );
  }

  async sendMessage(userId: string, matchId: string, content: string) {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      throw new BadRequestException('Message content cannot be empty.');
    }

    const activeMatch = await this.getOwnedActiveMatch(userId, matchId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockUserPair(
        tx,
        activeMatch.pet1.ownerId,
        activeMatch.pet2.ownerId,
      );
      const match = await this.getLockedMatch(tx, matchId);
      this.ensureMatchAllowsChat(match, userId);
      await this.ensureNoUserBlock(
        tx,
        match.pet1.ownerId,
        match.pet2.ownerId,
      );

      const message = await tx.message.create({
        data: { matchId, senderId: userId, content: normalizedContent },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
      await tx.match.update({
        where: { id: matchId },
        data: { updatedAt: new Date() },
      });
      return message;
    });
  }

  async sendImageMessage(
    userId: string,
    matchId: string,
    file: { buffer: Buffer; mimetype: string },
    content?: string,
  ) {
    const activeMatch = await this.getOwnedActiveMatch(userId, matchId);
    const uploaded = await this.cloudinary.uploadBuffer(
      file.buffer,
      `petmatching/users/${userId}/chat/${matchId}`,
      {
        quality: 'auto:good',
        fetch_format: 'auto',
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
      },
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockUserPair(
          tx,
          activeMatch.pet1.ownerId,
          activeMatch.pet2.ownerId,
        );
        const match = await this.getLockedMatch(tx, matchId);
        this.ensureMatchAllowsChat(match, userId);
        await this.ensureNoUserBlock(
          tx,
          match.pet1.ownerId,
          match.pet2.ownerId,
        );

        const message = await tx.message.create({
          data: {
            matchId,
            senderId: userId,
            content: content?.trim().slice(0, 2000) || '',
            imageUrl: uploaded.url,
          },
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
          },
        });
        await tx.match.update({
          where: { id: matchId },
          data: { updatedAt: new Date() },
        });
        return message;
      });
    } catch (error) {
      await this.cloudinary.destroyByUrl(uploaded.url);
      throw error;
    }
  }

  private async getOwnedActiveMatch(userId: string, matchId: string) {
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        status: { in: CHAT_ENABLED_MATCH_STATUSES },
        OR: [{ pet1: { ownerId: userId } }, { pet2: { ownerId: userId } }],
      },
      select: {
        id: true,
        pet1: { select: { ownerId: true, status: true } },
        pet2: { select: { ownerId: true, status: true } },
      },
    });
    if (!match) {
      throw new NotFoundException(
        'Không tìm thấy match đang cho phép trò chuyện.',
      );
    }
    await this.ensureNoUserBlock(
      this.prisma,
      match.pet1.ownerId,
      match.pet2.ownerId,
    );
    this.ensurePetsAllowChat(match);
    return match;
  }

  private ensureMatchAllowsChat(
    match: MatchWithParticipants,
    userId: string,
  ): void {
    const isParticipant =
      match.pet1.ownerId === userId || match.pet2.ownerId === userId;
    const allowsChat = CHAT_ENABLED_MATCH_STATUSES.includes(match.status);

    if (!isParticipant || !allowsChat) {
      throw new NotFoundException(
        'Không tìm thấy match đang cho phép trò chuyện.',
      );
    }
    this.ensurePetsAllowChat(match);
  }

  private ensurePetsAllowChat(match: {
    pet1: { status: PetStatus };
    pet2: { status: PetStatus };
  }): void {
    if (
      match.pet1.status === PetStatus.HIDDEN ||
      match.pet2.status === PetStatus.HIDDEN
    ) {
      throw new ForbiddenException(
        'Phòng chat tạm khóa vì một thú cưng đang bị quản trị viên ẩn.',
      );
    }
  }

  private async getLockedMatch(tx: Prisma.TransactionClient, matchId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "matches" WHERE "id" = ${matchId} FOR UPDATE`,
    );
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: matchParticipantInclude,
    });
    if (!match) {
      throw new NotFoundException('Không tìm thấy match.');
    }
    return match;
  }

  private async lockUserPair(
    tx: Prisma.TransactionClient,
    firstUserId: string,
    secondUserId: string,
  ) {
    const pairKey = [firstUserId, secondUserId].sort().join(':');
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))`,
    );
  }

  private async getBlockedUserIds(userId: string) {
    const blocks = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return blocks.map((block) =>
      block.blockerId === userId ? block.blockedId : block.blockerId,
    );
  }

  private async ensureNoUserBlock(
    client: PrismaService | Prisma.TransactionClient,
    firstUserId: string,
    secondUserId: string,
  ) {
    const block = await client.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: firstUserId, blockedId: secondUserId },
          { blockerId: secondUserId, blockedId: firstUserId },
        ],
      },
      select: { id: true },
    });
    if (block) {
      throw new ForbiddenException(
        'Không thể tương tác vì một trong hai người dùng đã chặn người kia.',
      );
    }
  }

  private getParticipantContext(match: MatchWithParticipants, userId: string) {
    const side =
      match.pet1.ownerId === userId
        ? 'pet1'
        : match.pet2.ownerId === userId
          ? 'pet2'
          : null;
    if (!side) {
      throw new ForbiddenException(
        'Bạn không phải là người tham gia match này.',
      );
    }

    const isPet1 = side === 'pet1';
    return {
      side,
      ownPet: isPet1 ? match.pet1 : match.pet2,
      ownOwner: isPet1 ? match.pet1.owner : match.pet2.owner,
      otherOwner: isPet1 ? match.pet2.owner : match.pet1.owner,
    };
  }

  // =============================================================
  // PRIVATE — Hard constraints
  // =============================================================

  private async getOwnedFemalePet(userId: string, petId: string) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException('Female pet not found.');
    }
    if (pet.ownerId !== userId) {
      throw new ForbiddenException('You do not own this pet.');
    }
    if (pet.gender !== Gender.FEMALE) {
      throw new BadRequestException(
        'Only female pets can send matching requests.',
      );
    }
    if (pet.status !== PetStatus.ACTIVE) {
      throw new BadRequestException('Only active pets can join matching.');
    }

    // Hard constraint: tuổi tối thiểu
    this.assertMinimumAge(pet);

    return pet;
  }

  private async getMaleCandidate(petId: string) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException('Male pet not found.');
    }
    if (pet.gender !== Gender.MALE) {
      throw new BadRequestException(
        'Only male pets can receive matching requests.',
      );
    }
    if (pet.status !== PetStatus.ACTIVE || !pet.isAvailableForMatching) {
      throw new BadRequestException('This pet is not available for matching.');
    }

    return pet;
  }

  /**
   * Kiểm tra tuổi tối thiểu: chó ≥ 12 tháng, mèo ≥ 8 tháng.
   * Throw BadRequestException nếu chưa đủ tuổi.
   */
  private assertMinimumAge(pet: Pet): void {
    const ageMonths = this.getAgeInMonths(pet.birthday);
    const minAge = MIN_AGE_MONTHS[pet.species];

    if (ageMonths < minAge) {
      throw new BadRequestException(
        `Bé ${pet.name} mới ${ageMonths} tháng tuổi. ` +
          `${pet.species === 'DOG' ? 'Chó' : 'Mèo'} cần ít nhất ${minAge} tháng tuổi để phối giống.`,
      );
    }
  }

  private getAgeInMonths(birthday: Date): number {
    const now = new Date();
    return (
      (now.getFullYear() - birthday.getFullYear()) * 12 +
      (now.getMonth() - birthday.getMonth())
    );
  }

  private ensureDifferentOwners(femalePet: Pet, malePet: Pet) {
    if (femalePet.ownerId === malePet.ownerId) {
      throw new BadRequestException('Cannot match pets from the same owner.');
    }
  }

  private async getPendingOwnedIncomingRequest(
    userId: string,
    requestId: string,
  ) {
    const request = await this.prisma.matchingRequest.findUnique({
      where: { id: requestId },
      include: {
        femalePet: true,
        malePet: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Matching request not found.');
    }
    if (request.malePet.ownerId !== userId) {
      throw new ForbiddenException('You cannot respond to this request.');
    }
    if (request.status !== MatchingRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be updated.');
    }

    return request;
  }

  // =============================================================
  // PRIVATE — Compatibility scoring
  // =============================================================

  /**
   * Tính điểm tương thích 0-100 với lý do chi tiết.
   *
   * Base score: 30
   * Cùng giống thuần chủng:      +25
   * Cùng location:               +15
   * Cả hai có phả hệ:            +10
   * Vaccine đã xác minh:          +5
   * Phả hệ đã xác minh:         +10
   * Cân nặng gần nhau (≤5kg):   +10
   * BreedRule compatible:        +20
   * BreedRule incompatible:      -10
   */
  private async calculateCompatibilityScore(
    femalePet: Pet,
    malePet: Pet,
  ): Promise<CompatibilityResult> {
    let score = 30;
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Cùng giống thuần chủng (+25)
    if (femalePet.breed === malePet.breed) {
      score += 25;
      reasons.push('same_breed');
    }

    // Cùng location (+15)
    if (femalePet.location === malePet.location) {
      score += 15;
      reasons.push('same_location');
    }

    // Cả hai có phả hệ (tự khai) (+10)
    if (femalePet.hasPedigree && malePet.hasPedigree) {
      score += 10;
      reasons.push('both_pedigree');
    }

    // Cả hai vaccine đã xác minh bởi moderator (+5)
    if (femalePet.vaccineVerified && malePet.vaccineVerified) {
      score += 5;
      reasons.push('both_vaccine_verified');
    }

    // Cả hai phả hệ đã xác minh bởi moderator (+10)
    if (femalePet.pedigreeVerified && malePet.pedigreeVerified) {
      score += 10;
      reasons.push('both_pedigree_verified');
    }

    // Cân nặng gần nhau ≤5kg (+10)
    if (Math.abs(femalePet.weight - malePet.weight) <= 5) {
      score += 10;
      reasons.push('similar_weight');
    }

    const breedRule = await this.findBreedRule(
      femalePet.species,
      femalePet.breed,
      malePet.breed,
    );
    return this.applyBreedRuleScore(score, reasons, warnings, breedRule);
  }

  private calculateCompatibilityScoreSync(
    femalePet: Pet,
    malePet: Pet,
    breedRules: BreedRule[],
  ): CompatibilityResult {
    let score = 30;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (femalePet.breed === malePet.breed) {
      score += 25;
      reasons.push('same_breed');
    }
    if (femalePet.location === malePet.location) {
      score += 15;
      reasons.push('same_location');
    }
    if (femalePet.hasPedigree && malePet.hasPedigree) {
      score += 10;
      reasons.push('both_pedigree');
    }
    if (femalePet.vaccineVerified && malePet.vaccineVerified) {
      score += 5;
      reasons.push('both_vaccine_verified');
    }
    if (femalePet.pedigreeVerified && malePet.pedigreeVerified) {
      score += 10;
      reasons.push('both_pedigree_verified');
    }
    if (Math.abs(femalePet.weight - malePet.weight) <= 5) {
      score += 10;
      reasons.push('similar_weight');
    }

    const breedRule =
      breedRules.find(
        (r) =>
          (r.breedA === femalePet.breed && r.breedB === malePet.breed) ||
          (r.breedA === malePet.breed && r.breedB === femalePet.breed),
      ) || null;

    return this.applyBreedRuleScore(score, reasons, warnings, breedRule);
  }

  private applyBreedRuleScore(
    score: number,
    reasons: string[],
    warnings: string[],
    breedRule: BreedRule | null,
  ): CompatibilityResult {
    let breedInfo: CompatibilityResult['breedInfo'] = undefined;

    if (breedRule) {
      breedInfo = {
        offspringName: breedRule.offspringName,
        warningNote: breedRule.warningNote,
        isCompatible: breedRule.isCompatible,
      };

      if (breedRule.isCompatible) {
        score += 20;
        reasons.push('breed_compatible');
      } else {
        score -= 10;
        reasons.push('breed_incompatible');
      }

      if (breedRule.warningNote) {
        warnings.push(breedRule.warningNote);
      }
    }

    return {
      score: Math.min(Math.max(score, 0), 100),
      reasons,
      warnings,
      breedInfo,
    };
  }

  /**
   * Tìm BreedRule theo cả 2 chiều: (A,B) hoặc (B,A)
   */
  private async findBreedRule(
    species: Species,
    breedA: string,
    breedB: string,
  ): Promise<BreedRule | null> {
    return this.prisma.breedRule.findFirst({
      where: {
        species,
        isActive: true,
        OR: [
          { breedA, breedB },
          { breedA: breedB, breedB: breedA },
        ],
      },
    });
  }

  // =============================================================
  // PRIVATE — Response mapping
  // =============================================================

  private requestInclude() {
    return {
      requester: { select: { id: true, name: true, email: true } },
      femalePet: {
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
          documents: true,
        },
      },
      malePet: {
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
          documents: true,
        },
      },
    } satisfies Prisma.MatchingRequestInclude;
  }

  private toPetCard(pet: PetWithOwner) {
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      gender: pet.gender,
      birthday: pet.birthday,
      weight: pet.weight,
      isVaccinated: pet.isVaccinated,
      hasPedigree: pet.hasPedigree,
      pedigreeNumber: pet.pedigreeNumber,
      vaccineVerified: pet.vaccineVerified,
      pedigreeVerified: pet.pedigreeVerified,
      avatar: pet.avatarUrl,
      avatarUrl: pet.avatarUrl,
      gallery: pet.gallery,
      personality: pet.personality,
      breedingOption: pet.breedingOption,
      breedingPrice: pet.breedingFee,
      location: pet.location,
      district: pet.district,
      ward: pet.ward,
      latitude: pet.latitude,
      longitude: pet.longitude,
      ownerName: pet.owner.name,
      ownerAvatar: pet.owner.avatarUrl,
      verified: pet.verificationBadge === VerificationBadge.VERIFIED,
      verificationBadge: pet.verificationBadge,
      status: pet.status,
      isAvailableForMatching: pet.isAvailableForMatching,
      updatedAt: pet.updatedAt,
    };
  }
}

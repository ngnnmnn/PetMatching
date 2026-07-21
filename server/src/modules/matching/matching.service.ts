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
  Pet,
  PetStatus,
  Prisma,
  Species,
  VerificationBadge,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMatchingRequestDto } from './dto/create-matching-request.dto';
import { GetCandidatesDto } from './dto/get-candidates.dto';
import { PassPetDto } from './dto/pass-pet.dto';

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

// Tuổi tối thiểu cho phối giống (tháng)
const MIN_AGE_MONTHS = { DOG: 12, CAT: 8 } as const;

// Chu kỳ nghỉ phối giống (tháng)
const BREEDING_COOLDOWN_MONTHS = { DOG: 6, CAT: 3 } as const;

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  async getCandidates(userId: string, dto: GetCandidatesDto) {
    const femalePet = await this.getOwnedFemalePet(userId, dto.femalePetId);

    // --- Hard constraint: kiểm tra chu kỳ phối giống của female pet ---
    const cycleCheck = this.checkBreedingCycle(femalePet);
    if (!cycleCheck.canBreed) {
      throw new BadRequestException(
        `Bé ${femalePet.name} đang trong thời gian nghỉ phối giống. ` +
          `Có thể phối lại từ ${cycleCheck.nextAvailable?.toLocaleDateString('vi-VN')}.`,
      );
    }

    // --- Hard constraint: tuổi tối thiểu cho query ---
    const minAgeDate = new Date();
    const minMonths = MIN_AGE_MONTHS[femalePet.species];
    minAgeDate.setMonth(minAgeDate.getMonth() - minMonths);

    const where: Prisma.PetWhereInput = {
      species: femalePet.species,
      gender: Gender.MALE,
      status: PetStatus.ACTIVE,
      isActive: true,
      isAvailableForMatching: true,
      ownerId: { not: userId },
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

    const history = await this.prisma.matchingRequest.findMany({
      where: {
        femalePetId: femalePet.id,
        malePetId: { in: candidates.map((candidate) => candidate.id) },
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
    });

    const latestByMalePetId = new Map(history.map((item) => [item.malePetId, item]));

    // Filter candidates và tính compatibility score (async)
    const eligibleCandidates = candidates.filter((candidate) => {
      const latest = latestByMalePetId.get(candidate.id);
      if (!latest) return true;

      const latestProfileUpdate =
        femalePet.updatedAt > candidate.updatedAt ? femalePet.updatedAt : candidate.updatedAt;

      return latest.createdAt < latestProfileUpdate;
    });

    // Tính compatibility scores song song
    const data = await Promise.all(
      eligibleCandidates.map(async (candidate) => {
        const compatibility = await this.calculateCompatibilityScore(femalePet, candidate);
        return {
          ...this.toPetCard(candidate),
          compatibilityScore: compatibility.score,
          matchReasons: compatibility.reasons,
          breedWarnings: compatibility.warnings,
          breedInfo: compatibility.breedInfo,
        };
      }),
    );

    // Sắp xếp theo điểm giảm dần
    data.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    return { data };
  }

  async passPet(userId: string, dto: PassPetDto) {
    const femalePet = await this.getOwnedFemalePet(userId, dto.femalePetId);
    const malePet = await this.getMaleCandidate(dto.malePetId);
    this.ensureDifferentOwners(femalePet, malePet);

    const request = await this.prisma.matchingRequest.create({
      data: {
        requesterId: userId,
        femalePetId: femalePet.id,
        malePetId: malePet.id,
        status: MatchingRequestStatus.PASSED,
      },
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

    // --- Hard constraint: kiểm tra chu kỳ ---
    const femaleCycle = this.checkBreedingCycle(femalePet);
    if (!femaleCycle.canBreed) {
      throw new BadRequestException(
        `Bé ${femalePet.name} đang trong thời gian nghỉ phối giống.`,
      );
    }

    const existingPending = await this.prisma.matchingRequest.findFirst({
      where: {
        femalePetId: femalePet.id,
        malePetId: malePet.id,
        status: MatchingRequestStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new ConflictException('A pending request already exists for this pair.');
    }

    const request = await this.prisma.matchingRequest.create({
      data: {
        requesterId: userId,
        femalePetId: femalePet.id,
        malePetId: malePet.id,
        note: dto.note,
        status: MatchingRequestStatus.PENDING,
      },
      include: this.requestInclude(),
    });

    return { success: true, request };
  }

  getIncomingRequests(userId: string) {
    return this.prisma.matchingRequest.findMany({
      where: {
        status: MatchingRequestStatus.PENDING,
        malePet: { ownerId: userId },
      },
      include: this.requestInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  getOutgoingRequests(userId: string) {
    return this.prisma.matchingRequest.findMany({
      where: {
        requesterId: userId,
        status: {
          not: MatchingRequestStatus.PASSED,
        },
      },
      include: this.requestInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptRequest(userId: string, requestId: string) {
    const request = await this.getPendingOwnedIncomingRequest(userId, requestId);
    const [pet1Id, pet2Id] = [request.femalePetId, request.malePetId].sort();

    const compatibility = await this.calculateCompatibilityScore(
      request.femalePet,
      request.malePet,
    );

    const result = await this.prisma.$transaction(async (tx) => {
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
        update: { status: MatchStatus.ACTIVE },
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

      return { request: updatedRequest, match };
    });

    return { success: true, ...result };
  }

  async rejectRequest(userId: string, requestId: string) {
    await this.getPendingOwnedIncomingRequest(userId, requestId);

    const request = await this.prisma.matchingRequest.update({
      where: { id: requestId },
      data: {
        status: MatchingRequestStatus.REJECTED,
        respondedAt: new Date(),
      },
      include: this.requestInclude(),
    });

    return { success: true, request };
  }

  getMatches(userId: string) {
    return this.prisma.match.findMany({
      where: {
        status: MatchStatus.ACTIVE,
        OR: [{ pet1: { ownerId: userId } }, { pet2: { ownerId: userId } }],
      },
      include: {
        pet1: { include: { owner: { select: { id: true, name: true, avatarUrl: true } } } },
        pet2: { include: { owner: { select: { id: true, name: true, avatarUrl: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
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
      throw new BadRequestException('Only female pets can send matching requests.');
    }
    if (pet.status !== PetStatus.ACTIVE || !pet.isActive) {
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
      throw new BadRequestException('Only male pets can receive matching requests.');
    }
    if (pet.status !== PetStatus.ACTIVE || !pet.isActive || !pet.isAvailableForMatching) {
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

  /**
   * Kiểm tra chu kỳ phối giống.
   * Chó cái: nghỉ 6 tháng sau mỗi lần phối.
   * Mèo cái: nghỉ 3 tháng sau mỗi lần phối.
   */
  private checkBreedingCycle(pet: Pet): { canBreed: boolean; nextAvailable?: Date } {
    if (!pet.lastBreedingAt) {
      return { canBreed: true };
    }

    const cooldownMonths = BREEDING_COOLDOWN_MONTHS[pet.species];
    const nextAvailable = new Date(pet.lastBreedingAt);
    nextAvailable.setMonth(nextAvailable.getMonth() + cooldownMonths);

    if (new Date() < nextAvailable) {
      return { canBreed: false, nextAvailable };
    }

    return { canBreed: true };
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

  private async getPendingOwnedIncomingRequest(userId: string, requestId: string) {
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

    // BreedRule lookup từ database
    const breedRule = await this.findBreedRule(femalePet.species, femalePet.breed, malePet.breed);
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
      femalePet: { include: { owner: { select: { id: true, name: true, avatarUrl: true } } } },
      malePet: { include: { owner: { select: { id: true, name: true, avatarUrl: true } } } },
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

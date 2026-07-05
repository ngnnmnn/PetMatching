import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Gender,
  MatchStatus,
  MatchingRequestStatus,
  Pet,
  PetStatus,
  Prisma,
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

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  async getCandidates(userId: string, dto: GetCandidatesDto) {
    const femalePet = await this.getOwnedFemalePet(userId, dto.femalePetId);
    const where: Prisma.PetWhereInput = {
      species: femalePet.species,
      gender: Gender.MALE,
      status: PetStatus.ACTIVE,
      isActive: true,
      isAvailableForMatching: true,
      ownerId: { not: userId },
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

    const data = candidates
      .filter((candidate) => {
        const latest = latestByMalePetId.get(candidate.id);
        if (!latest) return true;

        const latestProfileUpdate =
          femalePet.updatedAt > candidate.updatedAt ? femalePet.updatedAt : candidate.updatedAt;

        return latest.createdAt < latestProfileUpdate;
      })
      .map((candidate) => ({
        ...this.toPetCard(candidate),
        compatibilityScore: this.calculateCompatibilityScore(femalePet, candidate),
      }))
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

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

  async acceptRequest(userId: string, requestId: string) {
    const request = await this.getPendingOwnedIncomingRequest(userId, requestId);
    const [pet1Id, pet2Id] = [request.femalePetId, request.malePetId].sort();

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
          compatibilityScore: this.calculateCompatibilityScore(request.femalePet, request.malePet),
          matchReasons: ['request_accepted'],
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

  private requestInclude() {
    return {
      requester: { select: { id: true, name: true, email: true } },
      femalePet: { include: { owner: { select: { id: true, name: true, avatarUrl: true } } } },
      malePet: { include: { owner: { select: { id: true, name: true, avatarUrl: true } } } },
    } satisfies Prisma.MatchingRequestInclude;
  }

  private calculateCompatibilityScore(femalePet: Pet, malePet: Pet) {
    let score = 40;
    if (femalePet.breed === malePet.breed) score += 25;
    if (femalePet.location === malePet.location) score += 15;
    if (femalePet.hasPedigree && malePet.hasPedigree) score += 10;
    if (
      femalePet.verificationBadge === VerificationBadge.VERIFIED &&
      malePet.verificationBadge === VerificationBadge.VERIFIED
    ) {
      score += 10;
    }
    if (Math.abs(femalePet.weight - malePet.weight) <= 5) score += 10;

    return Math.min(score, 100);
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
      status: pet.status,
      isAvailableForMatching: pet.isAvailableForMatching,
      updatedAt: pet.updatedAt,
    };
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, Gender, PetStatus, VerificationBadge } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

const MALE_BREAKDOWN_DAYS = 14;

@Injectable()
export class PetsService {
  constructor(private prisma: PrismaService) {}

  getMyPets(userId: string) {
    return this.prisma.pet.findMany({
      where: { ownerId: userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  createPet(userId: string, dto: CreatePetDto) {
    const birthday = new Date(dto.birthday);
    if (Number.isNaN(birthday.getTime())) {
      throw new BadRequestException('Birthday is invalid.');
    }
    if (dto.status === PetStatus.BREAKDOWN) {
      throw new BadRequestException(
        'Trạng thái nghỉ sau phối giống chỉ được hệ thống cập nhật.',
      );
    }

    const documents = [];
    if (dto.isVaccinated) {
      documents.push({
        type: DocumentType.VACCINE_RECORD,
        title: 'Sổ tiêm phòng',
        imageUrls: dto.vaccineDocumentUrls ?? [],
        userNote: dto.vaccineNote ?? 'Người dùng khai báo đã tiêm đủ 3 mũi cơ bản.',
        status: DocumentStatus.PENDING,
      });
    }
    if (dto.hasPedigree) {
      documents.push({
        type: DocumentType.PEDIGREE_CERT,
        title: 'Giấy chứng nhận phả hệ',
        imageUrls: dto.pedigreeDocumentUrls ?? [],
        userNote: dto.pedigreeNote ?? dto.pedigreeNumber,
        status: DocumentStatus.PENDING,
      });
    }

    return this.prisma.pet.create({
      data: {
        ownerId: userId,
        name: dto.name,
        species: dto.species,
        breed: dto.breed,
        gender: dto.gender,
        birthday,
        weight: dto.weight,
        location: dto.location,
        district: dto.district,
        ward: dto.ward,
        latitude: dto.latitude,
        longitude: dto.longitude,
        avatarUrl: dto.avatarUrl,
        gallery: dto.gallery ?? [],
        personality: dto.personality,
        isVaccinated: dto.isVaccinated ?? false,
        hasPedigree: dto.hasPedigree ?? false,
        pedigreeNumber: dto.pedigreeNumber,
        breedingOption: dto.breedingOption,
        breedingFee: dto.breedingFee,
        verificationBadge: documents.length ? VerificationBadge.PENDING : VerificationBadge.NONE,
        status: dto.status ?? PetStatus.ACTIVE,
        isAvailableForMatching: false,
        documents: documents.length ? { create: documents } : undefined,
      },
      include: { documents: true },
    });
  }

  async updateAvailability(userId: string, petId: string, dto: UpdateAvailabilityDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "pets" WHERE "id" = ${petId} FOR UPDATE`;
      const pet = await tx.pet.findUnique({ where: { id: petId } });
      if (!pet) {
        throw new NotFoundException('Pet not found.');
      }
      if (pet.ownerId !== userId) {
        throw new ForbiddenException('You do not own this pet.');
      }

      if (
        pet.status !== PetStatus.BREAKDOWN &&
        dto.status === PetStatus.BREAKDOWN
      ) {
        throw new BadRequestException(
          'Trạng thái nghỉ sau phối giống chỉ được hệ thống cập nhật.',
        );
      }

      let nextStatus = dto.status ?? pet.status;
      const isMatchingAvailable =
        nextStatus === PetStatus.HIDDEN
          ? false
          : (dto.isAvailableForMatching ?? pet.isAvailableForMatching);

      if (pet.gender !== Gender.MALE && isMatchingAvailable) {
        throw new BadRequestException(
          'Only male pets can be available for matching.',
        );
      }

      let isEarlyOverride = false;
      if (pet.status === PetStatus.BREAKDOWN) {
        if (!isMatchingAvailable) {
          if (dto.status && dto.status !== PetStatus.BREAKDOWN) {
            throw new BadRequestException(
              'Thú cưng đang trong thời gian nghỉ sau phối giống.',
            );
          }
        } else {
          if (!pet.lastBreedingAt) {
            throw new BadRequestException(
              'Không xác định được thời gian kết thúc nghỉ phối giống.',
            );
          }

          const breakdownUntil = new Date(pet.lastBreedingAt);
          breakdownUntil.setDate(
            breakdownUntil.getDate() + MALE_BREAKDOWN_DAYS,
          );
          isEarlyOverride = new Date() < breakdownUntil;

          if (isEarlyOverride && !dto.confirmBreakdownOverride) {
            throw new BadRequestException({
              code: 'PET_BREAKDOWN_CONFIRMATION_REQUIRED',
              message: `${pet.name} đang trong thời gian nghỉ sau phối giống đến ${breakdownUntil.toLocaleDateString('vi-VN')}. Bạn có chắc muốn bật ghép đôi sớm không?`,
              breakdownUntil: breakdownUntil.toISOString(),
            });
          }

          nextStatus = PetStatus.ACTIVE;
        }
      }

      const updatedPet = await tx.pet.update({
        where: { id: petId },
        data: {
          status: nextStatus,
          isAvailableForMatching: isMatchingAvailable,
          ...(dto.breedingOption ? { breedingOption: dto.breedingOption } : {}),
          ...(dto.breedingFee !== undefined ? { breedingFee: dto.breedingFee } : {}),
          ...(dto.shareLitterCount !== undefined ? { shareLitterCount: dto.shareLitterCount } : {}),
          ...(dto.personality !== undefined ? { personality: dto.personality } : {}),
        },
      });

      if (isEarlyOverride && dto.confirmBreakdownOverride) {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'PET_BREAKDOWN_OVERRIDE',
            targetType: 'Pet',
            targetId: petId,
            metadata: {
              lastBreedingAt: pet.lastBreedingAt?.toISOString() ?? null,
            },
          },
        });
      }

      return updatedPet;
    });
  }
}

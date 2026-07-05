import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, Gender, PetStatus, VerificationBadge } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';

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
        isActive: (dto.status ?? PetStatus.ACTIVE) === PetStatus.ACTIVE,
        isAvailableForMatching: false,
        documents: documents.length ? { create: documents } : undefined,
      },
      include: { documents: true },
    });
  }

  async updateAvailability(userId: string, petId: string, isAvailable: boolean) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException('Pet not found.');
    }
    if (pet.ownerId !== userId) {
      throw new ForbiddenException('You do not own this pet.');
    }
    if (pet.gender !== Gender.MALE && isAvailable) {
      throw new BadRequestException('Only male pets can be available for matching.');
    }
    if (pet.status !== PetStatus.ACTIVE && isAvailable) {
      throw new BadRequestException('Only active pets can be available for matching.');
    }

    return this.prisma.pet.update({
      where: { id: petId },
      data: { isAvailableForMatching: isAvailable },
    });
  }
}

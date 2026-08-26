import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  Gender,
  PetStatus,
  VerificationBadge,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  getMyPets(userId: string) {
    return this.prisma.pet.findMany({
      where: { ownerId: userId },
      include: { documents: { orderBy: { updatedAt: 'desc' } } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getPetDetail(userId: string, petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: { documents: { orderBy: { updatedAt: 'desc' } } },
    });
    if (!pet) {
      throw new NotFoundException('Pet not found.');
    }
    const { ownerId, ...detail } = pet;
    if (ownerId !== userId) {
      throw new ForbiddenException('You do not own this pet.');
    }
    return detail;
  }

  createPet(userId: string, dto: CreatePetDto) {
    const birthday = new Date(dto.birthday);
    if (Number.isNaN(birthday.getTime())) {
      throw new BadRequestException('Birthday is invalid.');
    }
    if (!dto.avatarUrl && (!dto.gallery || dto.gallery.length === 0)) {
      throw new BadRequestException(
        'Hồ sơ thú cưng phải có tối thiểu ít nhất 1 ảnh đại diện hoặc ảnh bộ sưu tập.',
      );
    }
    const documents = [];
    if (dto.isVaccinated) {
      documents.push({
        type: DocumentType.VACCINE_RECORD,
        title: 'Sổ tiêm phòng',
        imageUrls: dto.vaccineDocumentUrls ?? [],
        userNote:
          dto.vaccineNote ?? 'Người dùng khai báo đã tiêm đủ 3 mũi cơ bản.',
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
        verificationBadge: documents.length
          ? VerificationBadge.PENDING
          : VerificationBadge.NONE,
        status: PetStatus.ACTIVE,
        isAvailableForMatching: false,
        documents: documents.length ? { create: documents } : undefined,
      },
      include: { documents: true },
    });
  }

  async updatePet(userId: string, petId: string, dto: UpdatePetDto) {
    const { updatedPet, obsoleteImageUrls } = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "pets" WHERE "id" = ${petId} FOR UPDATE`;
        const pet = await tx.pet.findUnique({
          where: { id: petId },
          include: { documents: { orderBy: { updatedAt: 'desc' } } },
        });
        if (!pet) {
          throw new NotFoundException('Pet not found.');
        }
        if (pet.ownerId !== userId) {
          throw new ForbiddenException('You do not own this pet.');
        }

        for (const [label, value] of [
          ['Name', dto.name],
          ['Breed', dto.breed],
          ['Location', dto.location],
        ] as const) {
          if (value !== undefined && !value.trim()) {
            throw new BadRequestException(`${label} cannot be empty.`);
          }
        }

        let birthday: Date | undefined;
        if (dto.birthday !== undefined) {
          birthday = new Date(dto.birthday);
          if (Number.isNaN(birthday.getTime())) {
            throw new BadRequestException('Birthday is invalid.');
          }
          if (birthday.getTime() > Date.now()) {
            throw new BadRequestException('Birthday cannot be in the future.');
          }
        }

        const nextAvatarUrl =
          dto.avatarUrl !== undefined ? dto.avatarUrl : pet.avatarUrl;
        const nextGallery =
          dto.gallery !== undefined ? dto.gallery : pet.gallery;
        if (!nextAvatarUrl && (!nextGallery || nextGallery.length === 0)) {
          throw new BadRequestException(
            'Hồ sơ thú cưng phải có tối thiểu ít nhất 1 ảnh đại diện hoặc ảnh bộ sưu tập.',
          );
        }

        const nextGender = dto.gender ?? pet.gender;
        const shouldDisableMatching =
          nextGender !== Gender.MALE && pet.isAvailableForMatching;

        const vaccineDocuments = pet.documents.filter(
          (document) => document.type === DocumentType.VACCINE_RECORD,
        );
        const pedigreeDocuments = pet.documents.filter(
          (document) => document.type === DocumentType.PEDIGREE_CERT,
        );
        const vaccineDocumentLocked =
          pet.vaccineVerified ||
          vaccineDocuments.some(
            (document) => document.status === DocumentStatus.APPROVED,
          );
        const pedigreeDocumentLocked =
          pet.pedigreeVerified ||
          pedigreeDocuments.some(
            (document) => document.status === DocumentStatus.APPROVED,
          );

        if (
          vaccineDocumentLocked &&
          (dto.vaccineDocumentUrls !== undefined || dto.isVaccinated === false)
        ) {
          throw new BadRequestException(
            'Approved vaccine documents cannot be changed.',
          );
        }
        if (
          pedigreeDocumentLocked &&
          (dto.pedigreeDocumentUrls !== undefined || dto.hasPedigree === false)
        ) {
          throw new BadRequestException(
            'Approved pedigree documents cannot be changed.',
          );
        }

        const nextIsVaccinated = dto.isVaccinated ?? pet.isVaccinated;
        const nextHasPedigree = dto.hasPedigree ?? pet.hasPedigree;
        if (dto.vaccineDocumentUrls?.length && !nextIsVaccinated) {
          throw new BadRequestException(
            'Vaccine documents require the vaccinated declaration.',
          );
        }
        if (dto.pedigreeDocumentUrls?.length && !nextHasPedigree) {
          throw new BadRequestException(
            'Pedigree documents require the pedigree declaration.',
          );
        }

        const obsoleteDocumentImageUrls: string[] = [];
        const documentUpdates = [
          {
            type: DocumentType.VACCINE_RECORD,
            title: 'Sổ tiêm phòng',
            urls: dto.vaccineDocumentUrls,
            enabled: nextIsVaccinated,
            existing: vaccineDocuments,
          },
          {
            type: DocumentType.PEDIGREE_CERT,
            title: 'Giấy chứng nhận phả hệ',
            urls: dto.pedigreeDocumentUrls,
            enabled: nextHasPedigree,
            existing: pedigreeDocuments,
          },
        ] as const;

        for (const documentUpdate of documentUpdates) {
          const shouldRemove = !documentUpdate.enabled;
          if (documentUpdate.urls === undefined && !shouldRemove) continue;

          const retainedUrls = new Set(documentUpdate.urls ?? []);
          obsoleteDocumentImageUrls.push(
            ...documentUpdate.existing
              .flatMap((document) => document.imageUrls)
              .filter((url) => !retainedUrls.has(url)),
          );

          if (shouldRemove || documentUpdate.urls?.length === 0) {
            await tx.petDocument.deleteMany({
              where: {
                petId,
                type: documentUpdate.type,
                status: { not: DocumentStatus.APPROVED },
              },
            });
            continue;
          }

          const [currentDocument, ...duplicateDocuments] =
            documentUpdate.existing;
          if (currentDocument) {
            await tx.petDocument.update({
              where: { id: currentDocument.id },
              data: {
                imageUrls: documentUpdate.urls,
                status: DocumentStatus.PENDING,
                reviewerId: null,
                reviewerName: null,
                reviewNote: null,
                reviewedAt: null,
              },
            });
            if (duplicateDocuments.length) {
              await tx.petDocument.deleteMany({
                where: {
                  id: { in: duplicateDocuments.map((document) => document.id) },
                  status: { not: DocumentStatus.APPROVED },
                },
              });
            }
          } else {
            await tx.petDocument.create({
              data: {
                petId,
                type: documentUpdate.type,
                title: documentUpdate.title,
                imageUrls: documentUpdate.urls,
                status: DocumentStatus.PENDING,
              },
            });
          }
        }

        const documentsChanged =
          dto.vaccineDocumentUrls !== undefined ||
          dto.pedigreeDocumentUrls !== undefined ||
          dto.isVaccinated === false ||
          dto.hasPedigree === false;
        const remainingDocuments = documentsChanged
          ? await tx.petDocument.findMany({
              where: { petId },
              select: { status: true },
            })
          : null;
        const pendingDocumentStatuses: DocumentStatus[] = [
          DocumentStatus.PENDING,
          DocumentStatus.REVIEWING,
          DocumentStatus.NEED_MORE_INFO,
        ];
        const verificationBadge = remainingDocuments
          ? remainingDocuments.some(
              (document) => document.status === DocumentStatus.APPROVED,
            )
            ? VerificationBadge.VERIFIED
            : remainingDocuments.some((document) =>
                  pendingDocumentStatuses.includes(document.status),
                )
              ? VerificationBadge.PENDING
              : VerificationBadge.NONE
          : undefined;

        const updatedPet = await tx.pet.update({
          where: { id: petId },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.species !== undefined ? { species: dto.species } : {}),
            ...(dto.breed !== undefined ? { breed: dto.breed.trim() } : {}),
            ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
            ...(birthday !== undefined ? { birthday } : {}),
            ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
            ...(dto.location !== undefined
              ? { location: dto.location.trim() }
              : {}),
            ...(dto.district !== undefined
              ? { district: dto.district?.trim() || null }
              : {}),
            ...(dto.ward !== undefined
              ? { ward: dto.ward?.trim() || null }
              : {}),
            ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
            ...(dto.longitude !== undefined
              ? { longitude: dto.longitude }
              : {}),
            ...(dto.avatarUrl !== undefined
              ? { avatarUrl: dto.avatarUrl }
              : {}),
            ...(dto.gallery !== undefined ? { gallery: dto.gallery } : {}),
            ...(dto.personality !== undefined
              ? { personality: dto.personality?.trim() || null }
              : {}),
            ...(dto.isVaccinated !== undefined
              ? {
                  isVaccinated: dto.isVaccinated,
                  ...(!dto.isVaccinated ? { vaccineVerified: false } : {}),
                }
              : {}),
            ...(dto.hasPedigree !== undefined
              ? {
                  hasPedigree: dto.hasPedigree,
                  ...(!dto.hasPedigree
                    ? { pedigreeNumber: null, pedigreeVerified: false }
                    : {}),
                }
              : {}),
            ...(dto.pedigreeNumber !== undefined && dto.hasPedigree !== false
              ? { pedigreeNumber: dto.pedigreeNumber?.trim() || null }
              : {}),
            ...(verificationBadge !== undefined ? { verificationBadge } : {}),
            ...(shouldDisableMatching ? { isAvailableForMatching: false } : {}),
          },
          include: { documents: { orderBy: { updatedAt: 'desc' } } },
        });

        const previousImageUrls = [pet.avatarUrl, ...pet.gallery].filter(
          (url): url is string => Boolean(url),
        );
        const retainedImageUrls = new Set(
          [updatedPet.avatarUrl, ...updatedPet.gallery].filter(
            (url): url is string => Boolean(url),
          ),
        );

        return {
          updatedPet,
          obsoleteImageUrls: [
            ...previousImageUrls.filter((url) => !retainedImageUrls.has(url)),
            ...obsoleteDocumentImageUrls,
          ],
        };
      },
    );

    const ownedImagePrefixes = [
      `petmatching/users/${userId}/pets/`,
      `petmatching/users/${userId}/pet-documents/`,
    ];
    const ownedObsoleteImageUrls = obsoleteImageUrls.filter((url) =>
      ownedImagePrefixes.some((prefix) =>
        this.cloudinary.publicIdFromUrl(url)?.startsWith(prefix),
      ),
    );
    await Promise.all(
      ownedObsoleteImageUrls.map((url) => this.cloudinary.destroyByUrl(url)),
    );
    return updatedPet;
  }

  async updateAvailability(
    userId: string,
    petId: string,
    dto: UpdateAvailabilityDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "pets" WHERE "id" = ${petId} FOR UPDATE`;
      const pet = await tx.pet.findUnique({ where: { id: petId } });
      if (!pet) {
        throw new NotFoundException('Pet not found.');
      }
      if (pet.ownerId !== userId) {
        throw new ForbiddenException('You do not own this pet.');
      }
      if (pet.status === PetStatus.HIDDEN) {
        throw new ForbiddenException(
          'Thú cưng đang bị quản trị viên ẩn do vi phạm.',
        );
      }
      if (dto.status === PetStatus.HIDDEN) {
        throw new ForbiddenException(
          'Bạn không có quyền đặt trạng thái ẩn của quản trị viên.',
        );
      }

      const nextStatus = dto.status ?? pet.status;
      const isMatchingAvailable =
        nextStatus === PetStatus.ACTIVE
          ? (dto.isAvailableForMatching ?? pet.isAvailableForMatching)
          : false;

      if (pet.gender !== Gender.MALE && isMatchingAvailable) {
        throw new BadRequestException(
          'Only male pets can be available for matching.',
        );
      }
      if (isMatchingAvailable) {
        const documentsNeedingReupload = await tx.petDocument.count({
          where: { petId, status: DocumentStatus.NEED_MORE_INFO },
        });
        if (documentsNeedingReupload) {
          throw new BadRequestException(
            'Vui lòng tải lại giấy tờ và chờ xác minh trước khi bật ghép đôi.',
          );
        }
      }

      const updatedPet = await tx.pet.update({
        where: { id: petId },
        data: {
          status: nextStatus,
          isAvailableForMatching: isMatchingAvailable,
          ...(dto.breedingOption ? { breedingOption: dto.breedingOption } : {}),
          ...(dto.breedingFee !== undefined
            ? { breedingFee: dto.breedingFee }
            : {}),
          ...(dto.shareLitterCount !== undefined
            ? { shareLitterCount: dto.shareLitterCount }
            : {}),
          ...(dto.personality !== undefined
            ? { personality: dto.personality }
            : {}),
        },
      });

      return updatedPet;
    });
  }
}

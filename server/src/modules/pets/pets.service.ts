import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  Gender,
  MatchStatus,
  PaymentStatus,
  PetStatus,
  Prisma,
  SpaBookingStatus,
  Species,
  VerificationBadge,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import {
  isPetMatchingWeightEligible,
  isPetProfileWeightValid,
  PET_WEIGHT_LIMITS,
} from '../../common/constants/pet-weight.constants';

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

  async deletePet(userId: string, petId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const spa = await this.prepareSpaBookingsForDeletion(
        tx,
        { petId },
        'PET',
      );
      const pets = await this.deleteOwnedPetsInTransaction(
        tx,
        userId,
        [petId],
        'PET_DELETED',
      );
      return {
        ...pets,
        cancelledSpaBookings: spa.cancelledSpaBookings,
        mediaUrls: [...spa.mediaUrls, ...pets.mediaUrls],
      };
    });

    await Promise.all(
      [...new Set(result.mediaUrls)].map((url) =>
        this.cloudinary.destroyByUrl(url),
      ),
    );

    return {
      success: true,
      message: `Đã xóa hồ sơ của ${result.petNames[0]}.`,
      cancelledSpaBookings: result.cancelledSpaBookings,
      cancelledMatchingRequests: result.cancelledMatchingRequests,
      endedMatches: result.endedMatches,
    };
  }

  async prepareSpaBookingsForDeletion(
    tx: Prisma.TransactionClient,
    where: Prisma.SpaBookingWhereInput,
    scope: 'PET' | 'USER',
  ) {
    const activeStatuses: SpaBookingStatus[] = [
      SpaBookingStatus.PENDING,
      SpaBookingStatus.CONFIRMED,
      SpaBookingStatus.ASSIGNED,
      SpaBookingStatus.CHECK_IN,
      SpaBookingStatus.ARRIVED,
      SpaBookingStatus.LATE,
      SpaBookingStatus.IN_PROGRESS,
    ];
    const activeBookings = await tx.spaBooking.findMany({
      where: { AND: [where, { status: { in: activeStatuses } }] },
      include: { payment: true },
      orderBy: { scheduledAt: 'asc' },
    });
    const blockers = activeBookings.filter(
      (booking) =>
        booking.status !== SpaBookingStatus.PENDING ||
        booking.payment?.status === PaymentStatus.PAID,
    );
    if (blockers.length > 0) {
      throw new ConflictException({
        code:
          scope === 'PET'
            ? 'PET_HAS_ACTIVE_SPA_BOOKING'
            : 'USER_HAS_ACTIVE_SPA_BOOKING',
        message:
          scope === 'PET'
            ? 'Không thể xóa thú cưng vì đang có lịch Spa đã xác nhận, đang thực hiện hoặc đã thanh toán.'
            : 'Không thể xóa tài khoản vì bạn hoặc thú cưng đang có lịch Spa đã xác nhận, đang thực hiện hoặc đã thanh toán.',
        bookings: blockers.map((booking) => ({
          id: booking.id,
          status: booking.status,
          scheduledAt: booking.scheduledAt,
        })),
      });
    }

    const pendingIds = activeBookings
      .filter((booking) => booking.status === SpaBookingStatus.PENDING)
      .map((booking) => booking.id);
    if (pendingIds.length > 0) {
      await tx.payment.updateMany({
        where: {
          spaBookingId: { in: pendingIds },
          status: {
            in: [
              PaymentStatus.PENDING,
              PaymentStatus.EXPIRED,
              PaymentStatus.PAYMENT_ERROR,
            ],
          },
        },
        data: { status: PaymentStatus.CANCELLED },
      });
      await tx.spaBooking.updateMany({
        where: { id: { in: pendingIds } },
        data: {
          status: SpaBookingStatus.CANCELLED,
          cancelReason:
            scope === 'PET'
              ? 'Hồ sơ thú cưng đã được xóa'
              : 'Tài khoản khách hàng đã được xóa',
        },
      });
    }

    const history = await tx.spaBooking.findMany({
      where,
      select: { photoAfter: true },
    });
    await tx.spaBooking.updateMany({
      where,
      data: {
        petId: null,
        petName: 'Thú cưng đã xóa',
        note: null,
        petConditionAfter: null,
        photoAfter: null,
        issueReported: null,
      },
    });

    return {
      cancelledSpaBookings: pendingIds.length,
      mediaUrls: history
        .map((booking) => booking.photoAfter)
        .filter((url): url is string => Boolean(url)),
    };
  }

  async deleteOwnedPetsInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    petIds: string[],
    reason: 'PET_DELETED' | 'USER_DELETED',
  ) {
    if (petIds.length === 0) {
      return {
        petNames: [] as string[],
        cancelledMatchingRequests: 0,
        endedMatches: 0,
        mediaUrls: [] as string[],
      };
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "pets" WHERE "id" IN (${Prisma.join(
        petIds,
      )}) ORDER BY "id" FOR UPDATE`,
    );
    const pets = await tx.pet.findMany({
      where: { id: { in: petIds } },
      include: { documents: { select: { imageUrls: true } } },
    });
    if (pets.length !== petIds.length) {
      throw new NotFoundException('Không tìm thấy thú cưng.');
    }
    if (pets.some((pet) => pet.ownerId !== userId)) {
      throw new ForbiddenException('Bạn không có quyền xóa thú cưng này.');
    }

    const now = new Date();
    const matchWhere: Prisma.MatchWhereInput = {
      OR: [{ pet1Id: { in: petIds } }, { pet2Id: { in: petIds } }],
    };
    const endedMatches = await tx.match.updateMany({
      where: { AND: [matchWhere, { status: MatchStatus.ACTIVE }] },
      data: {
        status: MatchStatus.CANCELLED,
        endedAt: now,
        endedById: reason === 'PET_DELETED' ? userId : null,
        endReason: reason,
      },
    });
    const cancelledRequests = await tx.matchingRequest.deleteMany({
      where: {
        OR: [
          { femalePetId: { in: petIds } },
          { malePetId: { in: petIds } },
          ...(reason === 'USER_DELETED' ? [{ requesterId: userId }] : []),
        ],
      },
    });

    const mediaUrls = pets.flatMap((pet) => [
      pet.avatarUrl,
      ...pet.gallery,
      ...pet.documents.flatMap((document) => document.imageUrls),
    ]);
    await tx.pet.deleteMany({ where: { id: { in: petIds } } });

    return {
      petNames: pets.map((pet) => pet.name),
      cancelledMatchingRequests: cancelledRequests.count,
      endedMatches: endedMatches.count,
      mediaUrls: mediaUrls.filter((url): url is string => Boolean(url)),
    };
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
    this.assertProfileWeight(dto.species, dto.weight);
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
        if (dto.weight !== undefined) {
          this.assertProfileWeight(pet.species, dto.weight);
        }

        for (const [label, value] of [
          ['Name', dto.name],
          ['Location', dto.location],
        ] as const) {
          if (value !== undefined && !value.trim()) {
            throw new BadRequestException(`${label} cannot be empty.`);
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

        const nextWeight = dto.weight ?? pet.weight;
        const shouldDisableMatching =
          pet.isAvailableForMatching &&
          !isPetMatchingWeightEligible(pet.species, nextWeight);

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
          (dto.pedigreeDocumentUrls !== undefined ||
            dto.hasPedigree === false ||
            (dto.pedigreeNumber !== undefined &&
              (dto.pedigreeNumber?.trim() || null) !==
                (pet.pedigreeNumber?.trim() || null)))
        ) {
          throw new BadRequestException(
            'Approved pedigree information and documents cannot be changed.',
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
        this.assertMatchingWeight(pet.species, pet.weight);
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

  private assertProfileWeight(species: Species, weight: number) {
    if (isPetProfileWeightValid(species, weight)) return;
    const limits = PET_WEIGHT_LIMITS[species];
    throw new BadRequestException(
      `Cân nặng của ${species === Species.DOG ? 'chó' : 'mèo'} phải nằm trong khoảng ${limits.profileMin}-${limits.profileMax} kg.`,
    );
  }

  private assertMatchingWeight(species: Species, weight: number) {
    if (isPetMatchingWeightEligible(species, weight)) return;
    const limits = PET_WEIGHT_LIMITS[species];
    throw new BadRequestException(
      `Thú cưng cần có cân nặng từ ${limits.matchingMin}-${limits.matchingMax} kg để tham gia ghép đôi.`,
    );
  }
}

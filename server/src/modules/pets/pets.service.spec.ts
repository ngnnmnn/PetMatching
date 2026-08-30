import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import {
  BreedingOption,
  DocumentStatus,
  DocumentType,
  Gender,
  Pet,
  PetDocument,
  PetStatus,
  Species,
  VerificationBadge,
} from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PetsService } from './pets.service';
import { UpdatePetDto } from './dto/update-pet.dto';

type PetWithDocuments = Pet & { documents: PetDocument[] };
type FindPet = (args: unknown) => Promise<PetWithDocuments | null>;
type CreatePet = (args: { data: Partial<Pet> }) => Promise<PetWithDocuments>;
type UpdatePet = (args: { data: Partial<Pet> }) => Promise<PetWithDocuments>;
type AsyncMock = (...args: unknown[]) => Promise<unknown>;

type TransactionMock = {
  $queryRaw: jest.MockedFunction<(...args: unknown[]) => Promise<unknown[]>>;
  pet: {
    findUnique: jest.MockedFunction<FindPet>;
    update: jest.MockedFunction<UpdatePet>;
  };
  petDocument: {
    create: jest.MockedFunction<AsyncMock>;
    update: jest.MockedFunction<AsyncMock>;
    deleteMany: jest.MockedFunction<AsyncMock>;
    findMany: jest.MockedFunction<AsyncMock>;
    count: jest.MockedFunction<AsyncMock>;
  };
};

describe('PetsService profile details and updates', () => {
  let detailFindUnique: jest.MockedFunction<FindPet>;
  let createPet: jest.MockedFunction<CreatePet>;
  let transactionPetFindUnique: jest.MockedFunction<FindPet>;
  let transactionPetUpdate: jest.MockedFunction<UpdatePet>;
  let tx: TransactionMock;
  let service: PetsService;
  const cloudinary = {
    destroyByUrl: jest.fn().mockResolvedValue(undefined),
    publicIdFromUrl: jest.fn((url: string) => {
      const marker = '/upload/';
      const path = url.slice(url.indexOf(marker) + marker.length);
      return path.replace(/\.[^/.]+$/, '');
    }),
  };

  const pet: PetWithDocuments = {
    id: 'pet-1',
    ownerId: 'owner-1',
    name: 'Milo',
    species: Species.DOG,
    breed: 'Poodle',
    gender: Gender.MALE,
    birthday: new Date('2024-01-01T00:00:00.000Z'),
    weight: 5,
    location: 'TP. Hồ Chí Minh',
    district: null,
    ward: null,
    latitude: null,
    longitude: null,
    avatarUrl: 'https://res.cloudinary.com/demo/image/upload/pets/milo.jpg',
    gallery: [],
    personality: null,
    isVaccinated: false,
    hasPedigree: false,
    pedigreeNumber: null,
    vaccineVerified: false,
    pedigreeVerified: false,
    verificationBadge: VerificationBadge.NONE,
    breedingOption: BreedingOption.NEGOTIATE,
    breedingFee: null,
    shareLitterCount: null,
    totalBreedings: 0,
    status: PetStatus.ACTIVE,
    isAvailableForMatching: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    documents: [],
  };

  beforeEach(() => {
    detailFindUnique = jest.fn() as jest.MockedFunction<FindPet>;
    detailFindUnique.mockResolvedValue(pet);
    createPet = jest.fn(({ data }) =>
      Promise.resolve({ ...pet, ...data, documents: [] }),
    );
    transactionPetFindUnique = jest.fn() as jest.MockedFunction<FindPet>;
    transactionPetFindUnique.mockResolvedValue(pet);
    const updateImplementation: UpdatePet = ({ data }) =>
      Promise.resolve({ ...pet, ...data });
    transactionPetUpdate = jest.fn(updateImplementation);
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      pet: {
        findUnique: transactionPetFindUnique,
        update: transactionPetUpdate,
      },
      petDocument: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const prisma = {
      pet: { findUnique: detailFindUnique, create: createPet },
      $transaction: jest
        .fn()
        .mockImplementation((callback: (client: TransactionMock) => unknown) =>
          callback(tx),
        ),
    };
    cloudinary.destroyByUrl.mockClear();
    service = new PetsService(
      prisma as unknown as PrismaService,
      cloudinary as unknown as CloudinaryService,
    );
  });

  it('returns an owned pet without exposing ownerId', async () => {
    const result = await service.getPetDetail('owner-1', 'pet-1');

    expect(result).toMatchObject({ id: 'pet-1', name: 'Milo' });
    expect(result).not.toHaveProperty('ownerId');
  });

  it('always creates a new pet as active with matching disabled', async () => {
    await service.createPet('owner-1', {
      name: 'Milo',
      species: Species.DOG,
      breed: 'Poodle',
      gender: Gender.MALE,
      birthday: '2024-01-01',
      weight: 5,
      location: 'TP. Hồ Chí Minh',
      avatarUrl: 'https://res.cloudinary.com/demo/image/upload/pets/milo.jpg',
    });

    const create = createPet.mock.calls[0]?.[0];
    expect(create?.data).toMatchObject({
      status: PetStatus.ACTIVE,
      isAvailableForMatching: false,
    });
  });

  it.each([
    [Species.DOG, 0.1],
    [Species.DOG, 160.1],
    [Species.CAT, 0.1],
    [Species.CAT, 20.1],
  ])(
    'rejects %s profile creation with invalid weight %s kg',
    (species, weight) => {
      expect(() =>
        service.createPet('owner-1', {
          name: 'Milo',
          species,
          breed: 'Poodle',
          gender: Gender.MALE,
          birthday: '2024-01-01',
          weight,
          location: 'Hà Nội',
          avatarUrl:
            'https://res.cloudinary.com/demo/image/upload/pets/milo.jpg',
        }),
      ).toThrow(BadRequestException);
      expect(createPet).not.toHaveBeenCalled();
    },
  );

  it.each([
    [Species.DOG, 0.2],
    [Species.DOG, 160],
    [Species.CAT, 0.2],
    [Species.CAT, 20],
  ])(
    'accepts %s profile creation at boundary weight %s kg',
    async (species, weight) => {
      await service.createPet('owner-1', {
        name: 'Milo',
        species,
        breed: species === Species.DOG ? 'Poodle' : 'Mèo ta',
        gender: Gender.MALE,
        birthday: '2024-01-01',
        weight,
        location: 'Hà Nội',
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/pets/milo.jpg',
      });

      expect(createPet).toHaveBeenCalled();
    },
  );

  it('rejects a missing pet detail', async () => {
    detailFindUnique.mockResolvedValue(null);

    await expect(
      service.getPetDetail('owner-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects access by a different owner', async () => {
    await expect(
      service.getPetDetail('owner-2', 'pet-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('trims editable text and persists image changes', async () => {
    await service.updatePet('owner-1', 'pet-1', {
      name: '  Milo mới  ',
      personality: '  Thân thiện  ',
      avatarUrl: 'https://res.cloudinary.com/demo/avatar.jpg',
      gallery: ['https://res.cloudinary.com/demo/gallery.jpg'],
    });

    const update = transactionPetUpdate.mock.calls[0]?.[0];
    expect(update?.data).toMatchObject({
      name: 'Milo mới',
      personality: 'Thân thiện',
      avatarUrl: 'https://res.cloudinary.com/demo/avatar.jpg',
      gallery: ['https://res.cloudinary.com/demo/gallery.jpg'],
    });
  });

  it.each([
    ['species', Species.CAT],
    ['breed', 'British Shorthair'],
    ['gender', Gender.FEMALE],
    ['birthday', '2023-01-01'],
  ])(
    'rejects immutable profile field %s at the DTO boundary',
    async (field, value) => {
      const pipe = new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      });

      await expect(
        pipe.transform(
          { name: 'Milo mới', [field]: value },
          { type: 'body', metatype: UpdatePetDto },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('does not persist immutable profile fields when the service is called directly', async () => {
    await service.updatePet('owner-1', 'pet-1', {
      name: 'Milo mới',
      species: Species.CAT,
      breed: 'British Shorthair',
      gender: Gender.FEMALE,
      birthday: '2023-01-01',
    } as UpdatePetDto & {
      species: Species;
      breed: string;
      gender: Gender;
      birthday: string;
    });

    const update = transactionPetUpdate.mock.calls[0]?.[0];
    expect(update?.data).toMatchObject({ name: 'Milo mới' });
    expect(update?.data).not.toHaveProperty('species');
    expect(update?.data).not.toHaveProperty('breed');
    expect(update?.data).not.toHaveProperty('gender');
    expect(update?.data).not.toHaveProperty('birthday');
  });

  it('rejects a cat profile weight above the species limit', async () => {
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      species: Species.CAT,
    });

    await expect(
      service.updatePet('owner-1', pet.id, { weight: 20.1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionPetUpdate).not.toHaveBeenCalled();
  });

  it.each([
    [Species.DOG, 1],
    [Species.DOG, 101],
    [Species.CAT, 1],
    [Species.CAT, 16],
  ])(
    'turns matching off when edited %s weight becomes %s kg',
    async (species, weight) => {
      transactionPetFindUnique.mockResolvedValue({ ...pet, species });

      await service.updatePet('owner-1', pet.id, { weight });

      expect(transactionPetUpdate.mock.calls[0]?.[0].data).toMatchObject({
        weight,
        isAvailableForMatching: false,
      });
    },
  );

  it('keeps matching enabled when an edited weight remains eligible', async () => {
    await service.updatePet('owner-1', pet.id, { weight: 100 });

    const update = transactionPetUpdate.mock.calls[0]?.[0].data;
    expect(update).toMatchObject({ weight: 100 });
    expect(update).not.toHaveProperty('isAvailableForMatching');
  });

  it('clears pedigree data when pedigree is disabled', async () => {
    await service.updatePet('owner-1', 'pet-1', { hasPedigree: false });

    const update = transactionPetUpdate.mock.calls[0]?.[0];
    expect(update?.data).toMatchObject({
      hasPedigree: false,
      pedigreeNumber: null,
      pedigreeVerified: false,
    });
  });

  it('deletes only replaced Cloudinary images after a successful update', async () => {
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      avatarUrl:
        'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pets/avatar/old-avatar.jpg',
      gallery: [
        'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pets/gallery/kept.jpg',
        'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pets/gallery/removed.jpg',
      ],
    });

    await service.updatePet('owner-1', 'pet-1', {
      avatarUrl:
        'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pets/avatar/new-avatar.jpg',
      gallery: [
        'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pets/gallery/kept.jpg',
      ],
    });

    expect(cloudinary.destroyByUrl).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pets/avatar/old-avatar.jpg',
    );
    expect(cloudinary.destroyByUrl).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pets/gallery/removed.jpg',
    );
    expect(cloudinary.destroyByUrl).not.toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pets/gallery/kept.jpg',
    );
  });

  it('does not enable matching while documents need to be uploaded again', async () => {
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      isAvailableForMatching: false,
    });
    tx.petDocument.count.mockResolvedValue(1);

    await expect(
      service.updateAvailability('owner-1', pet.id, {
        isAvailableForMatching: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionPetUpdate).not.toHaveBeenCalled();
  });

  it('uses INACTIVE when an owner hides a pet and disables matching', async () => {
    await service.updateAvailability('owner-1', pet.id, {
      status: PetStatus.INACTIVE,
    });

    expect(transactionPetUpdate.mock.calls[0]?.[0].data).toMatchObject({
      status: PetStatus.INACTIVE,
      isAvailableForMatching: false,
    });
  });

  it('lets an owner restore an inactive pet without enabling matching', async () => {
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      status: PetStatus.INACTIVE,
      isAvailableForMatching: false,
    });

    await service.updateAvailability('owner-1', pet.id, {
      status: PetStatus.ACTIVE,
    });

    expect(transactionPetUpdate.mock.calls[0]?.[0].data).toMatchObject({
      status: PetStatus.ACTIVE,
      isAvailableForMatching: false,
    });
  });

  it('lets an owner turn matching off without hiding an active pet', async () => {
    await service.updateAvailability('owner-1', pet.id, {
      isAvailableForMatching: false,
    });

    expect(transactionPetUpdate.mock.calls[0]?.[0].data).toMatchObject({
      status: PetStatus.ACTIVE,
      isAvailableForMatching: false,
    });
  });

  it('lets an eligible active male pet enable matching', async () => {
    await service.updateAvailability('owner-1', pet.id, {
      isAvailableForMatching: true,
    });

    expect(transactionPetUpdate.mock.calls[0]?.[0].data).toMatchObject({
      status: PetStatus.ACTIVE,
      isAvailableForMatching: true,
    });
  });

  it.each([
    [Species.DOG, 1.4],
    [Species.DOG, 100.1],
    [Species.CAT, 1.4],
    [Species.CAT, 15.1],
  ])('does not enable matching for %s at %s kg', async (species, weight) => {
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      species,
      weight,
      isAvailableForMatching: false,
    });

    await expect(
      service.updateAvailability('owner-1', pet.id, {
        isAvailableForMatching: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionPetUpdate).not.toHaveBeenCalled();
  });

  it('does not allow an owner to set the admin-only HIDDEN status', async () => {
    await expect(
      service.updateAvailability('owner-1', pet.id, {
        status: PetStatus.HIDDEN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactionPetUpdate).not.toHaveBeenCalled();
  });

  it('does not allow an owner to restore an admin-hidden pet', async () => {
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      status: PetStatus.HIDDEN,
      isAvailableForMatching: false,
    });

    await expect(
      service.updateAvailability('owner-1', pet.id, {
        status: PetStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactionPetUpdate).not.toHaveBeenCalled();
  });

  it('replaces an unapproved vaccine document and resubmits it', async () => {
    const oldUrl =
      'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pet-documents/vaccines/old.jpg';
    const newUrl =
      'https://res.cloudinary.com/demo/image/upload/petmatching/users/owner-1/pet-documents/vaccines/new.jpg';
    const document: PetDocument = {
      id: 'document-1',
      petId: pet.id,
      type: DocumentType.VACCINE_RECORD,
      title: 'Sổ tiêm phòng',
      imageUrls: [oldUrl],
      userNote: null,
      status: DocumentStatus.REJECTED,
      reviewerId: 'reviewer-1',
      reviewerName: 'Admin',
      reviewNote: 'Ảnh chưa rõ',
      reviewedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      isVaccinated: true,
      documents: [document],
    });
    tx.petDocument.findMany.mockResolvedValue([
      { status: DocumentStatus.PENDING },
    ]);

    await service.updatePet('owner-1', pet.id, {
      vaccineDocumentUrls: [newUrl],
    });

    const documentUpdateCall = tx.petDocument.update.mock.calls[0]?.[0];
    expect(documentUpdateCall).toMatchObject({
      where: { id: document.id },
      data: {
        imageUrls: [newUrl],
        status: DocumentStatus.PENDING,
        reviewerId: null,
        reviewerName: null,
        reviewNote: null,
        reviewedAt: null,
      },
    });
    expect(transactionPetUpdate.mock.calls[0]?.[0].data).toMatchObject({
      verificationBadge: VerificationBadge.PENDING,
    });
    expect(cloudinary.destroyByUrl).toHaveBeenCalledWith(oldUrl);
  });

  it('rejects changes to an approved pedigree document', async () => {
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      hasPedigree: true,
      pedigreeVerified: true,
      documents: [
        {
          id: 'document-2',
          petId: pet.id,
          type: DocumentType.PEDIGREE_CERT,
          title: 'Giấy chứng nhận phả hệ',
          imageUrls: ['https://example.com/approved.jpg'],
          userNote: null,
          status: DocumentStatus.APPROVED,
          reviewerId: 'reviewer-1',
          reviewerName: 'Admin',
          reviewNote: null,
          reviewedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    await expect(
      service.updatePet('owner-1', pet.id, {
        pedigreeDocumentUrls: ['https://example.com/replacement.jpg'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.petDocument.update).not.toHaveBeenCalled();
    expect(transactionPetUpdate).not.toHaveBeenCalled();
  });

  it('rejects pedigree number changes after pedigree approval', async () => {
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      hasPedigree: true,
      pedigreeNumber: 'VKA-001',
      pedigreeVerified: true,
      documents: [
        {
          id: 'document-2',
          petId: pet.id,
          type: DocumentType.PEDIGREE_CERT,
          title: 'Giấy chứng nhận phả hệ',
          imageUrls: ['https://example.com/approved.jpg'],
          userNote: null,
          status: DocumentStatus.APPROVED,
          reviewerId: 'reviewer-1',
          reviewerName: 'Admin',
          reviewNote: null,
          reviewedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    await expect(
      service.updatePet('owner-1', pet.id, {
        pedigreeNumber: 'VKA-999',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionPetUpdate).not.toHaveBeenCalled();
  });

  it('removes unapproved documents when the declaration is disabled', async () => {
    transactionPetFindUnique.mockResolvedValue({
      ...pet,
      isVaccinated: true,
      documents: [
        {
          id: 'document-3',
          petId: pet.id,
          type: DocumentType.VACCINE_RECORD,
          title: 'Sổ tiêm phòng',
          imageUrls: [],
          userNote: null,
          status: DocumentStatus.PENDING,
          reviewerId: null,
          reviewerName: null,
          reviewNote: null,
          reviewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    await service.updatePet('owner-1', pet.id, { isVaccinated: false });

    expect(tx.petDocument.deleteMany).toHaveBeenCalledWith({
      where: {
        petId: pet.id,
        type: DocumentType.VACCINE_RECORD,
        status: { not: DocumentStatus.APPROVED },
      },
    });
  });

  it('rejects updates from a different owner', async () => {
    await expect(
      service.updatePet('owner-2', 'pet-1', { name: 'Nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactionPetUpdate).not.toHaveBeenCalled();
  });
});

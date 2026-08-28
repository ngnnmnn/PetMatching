import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Gender,
  MatchingRequestStatus,
  MatchStatus,
  PetStatus,
  Species,
} from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MatchingService } from './matching.service';

type TransactionMock = {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  match: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  message: {
    create: jest.Mock;
  };
  userBlock: { findFirst: jest.Mock };
};

describe('MatchingService chat', () => {
  const userId = 'user-1';
  const matchId = 'match-1';
  const imageUrl = 'https://res.cloudinary.com/demo/image/upload/chat.jpg';

  let transaction: TransactionMock;
  let prisma: {
    $transaction: jest.Mock;
    match: { findFirst: jest.Mock };
    message: { updateMany: jest.Mock };
    userBlock: { findFirst: jest.Mock };
  };
  let cloudinary: {
    uploadBuffer: jest.Mock;
    destroyByUrl: jest.Mock;
  };
  let service: MatchingService;

  const createMatch = (status: MatchStatus = MatchStatus.ACTIVE) => ({
    id: matchId,
    status,
    pet1: {
      id: 'pet-1',
      ownerId: userId,
      status: PetStatus.ACTIVE,
      owner: { id: userId, name: 'User 1', email: 'user1@example.com' },
    },
    pet2: {
      id: 'pet-2',
      ownerId: 'user-2',
      status: PetStatus.ACTIVE,
      owner: {
        id: 'user-2',
        name: 'User 2',
        email: 'user2@example.com',
      },
    },
  });

  beforeEach(() => {
    transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      match: {
        findUnique: jest.fn().mockResolvedValue(createMatch()),
        update: jest.fn().mockResolvedValue({ id: matchId }),
      },
      message: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'message-1',
            ...data,
            createdAt: new Date('2026-08-05T00:00:00.000Z'),
          }),
        ),
      },
      userBlock: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: TransactionMock) => unknown) =>
          Promise.resolve(callback(transaction)),
        ),
      match: {
        findFirst: jest.fn().mockResolvedValue({
          id: matchId,
          pet1: { ownerId: userId, status: PetStatus.ACTIVE },
          pet2: { ownerId: 'user-2', status: PetStatus.ACTIVE },
        }),
      },
      message: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userBlock: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    cloudinary = {
      uploadBuffer: jest.fn().mockResolvedValue({ url: imageUrl }),
      destroyByUrl: jest.fn().mockResolvedValue(undefined),
    };
    service = new MatchingService(
      prisma as unknown as PrismaService,
      cloudinary as unknown as CloudinaryService,
      {} as any,
    );
  });

  it('locks the match before saving a text message', async () => {
    await service.sendMessage(userId, matchId, '  hello  ');

    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { matchId, senderId: userId, content: 'hello' },
      }),
    );
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.message.create.mock.invocationCallOrder[0],
    );
  });

  it('does not save text after the match is cancelled', async () => {
    transaction.match.findUnique.mockResolvedValue(
      createMatch(MatchStatus.CANCELLED),
    );

    await expect(
      service.sendMessage(userId, matchId, 'hello'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.message.create).not.toHaveBeenCalled();
  });

  it('does not allow a non-participant to send text', async () => {
    await expect(
      service.sendMessage('other-user', matchId, 'hello'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.message.create).not.toHaveBeenCalled();
  });

  it('does not save a message when either user has blocked the other', async () => {
    transaction.userBlock.findFirst.mockResolvedValue({ id: 'block-1' });

    await expect(service.sendMessage(userId, matchId, 'hello')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(transaction.message.create).not.toHaveBeenCalled();
  });

  it('does not save text when a pet is hidden during moderation', async () => {
    transaction.match.findUnique.mockResolvedValue({
      ...createMatch(),
      pet2: { ...createMatch().pet2, status: PetStatus.HIDDEN },
    });

    await expect(
      service.sendMessage(userId, matchId, 'hello'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction.message.create).not.toHaveBeenCalled();
  });

  it('allows chat again after the hidden pet is restored', async () => {
    prisma.match.findFirst.mockResolvedValueOnce({
      id: matchId,
      pet1: { ownerId: userId, status: PetStatus.HIDDEN },
      pet2: { ownerId: 'user-2', status: PetStatus.ACTIVE },
    });

    await expect(
      service.sendMessage(userId, matchId, 'blocked'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction.message.create).not.toHaveBeenCalled();

    prisma.match.findFirst.mockResolvedValueOnce({
      id: matchId,
      pet1: { ownerId: userId, status: PetStatus.ACTIVE },
      pet2: { ownerId: 'user-2', status: PetStatus.ACTIVE },
    });
    await service.sendMessage(userId, matchId, 'restored');

    expect(transaction.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { matchId, senderId: userId, content: 'restored' },
      }),
    );
  });

  it('saves a Cloudinary URL after locking an active match', async () => {
    await service.sendImageMessage(userId, matchId, {
      buffer: Buffer.from('image'),
      mimetype: 'image/png',
    });

    expect(prisma.match.findFirst).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.message.create).toHaveBeenCalledWith({
      data: {
        matchId,
        senderId: userId,
        content: '',
        imageUrl,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    expect(cloudinary.destroyByUrl).not.toHaveBeenCalled();
  });

  it('removes an uploaded image if the match ends during upload', async () => {
    transaction.match.findUnique.mockResolvedValue(
      createMatch(MatchStatus.CANCELLED),
    );

    await expect(
      service.sendImageMessage(userId, matchId, {
        buffer: Buffer.from('image'),
        mimetype: 'image/png',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.message.create).not.toHaveBeenCalled();
    expect(cloudinary.destroyByUrl).toHaveBeenCalledWith(imageUrl);
  });

  it('removes an uploaded image if a pet is hidden during upload', async () => {
    transaction.match.findUnique.mockResolvedValue({
      ...createMatch(),
      pet1: { ...createMatch().pet1, status: PetStatus.HIDDEN },
    });

    await expect(
      service.sendImageMessage(userId, matchId, {
        buffer: Buffer.from('image'),
        mimetype: 'image/png',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction.message.create).not.toHaveBeenCalled();
    expect(cloudinary.destroyByUrl).toHaveBeenCalledWith(imageUrl);
  });

  it('removes an uploaded image if saving the message fails', async () => {
    transaction.message.create.mockRejectedValue(new Error('database error'));

    await expect(
      service.sendImageMessage(userId, matchId, {
        buffer: Buffer.from('image'),
        mimetype: 'image/png',
      }),
    ).rejects.toThrow('database error');
    expect(cloudinary.destroyByUrl).toHaveBeenCalledWith(imageUrl);
  });

  it('returns persisted history and marks incoming messages as read', async () => {
    const incoming = {
      id: 'message-2',
      matchId,
      senderId: 'user-2',
      content: 'hello',
      imageUrl: null,
      isRead: false,
      createdAt: new Date('2026-08-05T00:00:00.000Z'),
      updatedAt: new Date('2026-08-05T00:00:00.000Z'),
      sender: { id: 'user-2', name: 'User 2', avatarUrl: null },
    };
    prisma.match.findFirst.mockResolvedValue({ messages: [incoming] });

    const messages = await service.getMessages(userId, matchId);

    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: { matchId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
    expect(messages).toEqual([{ ...incoming, isRead: true }]);
  });

  it('does not expose chat history to a non-participant', async () => {
    prisma.match.findFirst.mockResolvedValue(null);

    await expect(
      service.getMessages('other-user', matchId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });
});

describe('MatchingService accepting requests', () => {
  const femalePet = {
    id: 'female-1',
    ownerId: 'female-owner',
    name: 'Luna',
    species: Species.DOG,
    breed: 'Poodle',
    gender: Gender.FEMALE,
    status: PetStatus.ACTIVE,
    location: 'HCM',
    weight: 5,
    hasPedigree: false,
    vaccineVerified: false,
    pedigreeVerified: false,
  };
  const malePet = {
    ...femalePet,
    id: 'male-1',
    ownerId: 'male-owner',
    name: 'Milo',
    gender: Gender.MALE,
  };

  const setupAcceptRequest = (
    femaleStatus: PetStatus = PetStatus.ACTIVE,
    maleStatus: PetStatus = PetStatus.ACTIVE,
  ) => {
    const request = {
      id: 'request-1',
      requesterId: femalePet.ownerId,
      femalePetId: femalePet.id,
      malePetId: malePet.id,
      status: MatchingRequestStatus.PENDING,
      femalePet,
      malePet,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      userBlock: { findFirst: jest.fn().mockResolvedValue(null) },
      matchingRequest: {
        findUnique: jest.fn().mockResolvedValue({
          status: MatchingRequestStatus.PENDING,
          femalePet: { status: femaleStatus },
          malePet: { status: maleStatus },
        }),
        update: jest.fn().mockResolvedValue({
          ...request,
          status: MatchingRequestStatus.ACCEPTED,
        }),
      },
      match: { upsert: jest.fn().mockResolvedValue({ id: 'match-1' }) },
    };
    const prisma = {
      matchingRequest: { findUnique: jest.fn().mockResolvedValue(request) },
      breedRule: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest
        .fn()
        .mockImplementation((callback: (client: typeof tx) => unknown) =>
          callback(tx),
        ),
    };
    const service = new MatchingService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
      {
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      } as unknown as NotificationsService,
    );
    return { request, service, tx };
  };

  it('accepts a pending request when both pets remain active', async () => {
    const { request, service, tx } = setupAcceptRequest();

    await expect(
      service.acceptRequest(malePet.ownerId, request.id),
    ).resolves.toMatchObject({ success: true, match: { id: 'match-1' } });
    expect(tx.matchingRequest.update).toHaveBeenCalledTimes(1);
    expect(tx.match.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not accept a pending request when a pet is no longer active', async () => {
    const { request, service, tx } = setupAcceptRequest(PetStatus.HIDDEN);

    await expect(
      service.acceptRequest(malePet.ownerId, request.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.matchingRequest.update).not.toHaveBeenCalled();
    expect(tx.match.upsert).not.toHaveBeenCalled();
  });
});

describe('MatchingService pet eligibility', () => {
  const activeFemale = {
    id: 'female-1',
    ownerId: 'owner-1',
    name: 'Luna',
    species: Species.DOG,
    breed: 'Poodle',
    gender: Gender.FEMALE,
    birthday: new Date('2020-01-01'),
    status: PetStatus.ACTIVE,
    location: 'HCM',
    weight: 5,
  };
  const activeMale = {
    ...activeFemale,
    id: 'male-1',
    ownerId: 'owner-2',
    name: 'Milo',
    gender: Gender.MALE,
    isAvailableForMatching: true,
  };

  it('only queries active male pets that enabled matching', async () => {
    const prisma = {
      pet: {
        findUnique: jest.fn().mockResolvedValue(activeFemale),
        findMany: jest.fn().mockResolvedValue([]),
      },
      userBlock: { findMany: jest.fn().mockResolvedValue([]) },
      matchingRequest: { findMany: jest.fn().mockResolvedValue([]) },
      breedRule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new MatchingService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
      {} as NotificationsService,
    );

    await service.getCandidates(activeFemale.ownerId, {
      femalePetId: activeFemale.id,
    });

    expect(prisma.pet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gender: Gender.MALE,
          status: PetStatus.ACTIVE,
          isAvailableForMatching: true,
        }),
      }),
    );
  });

  it('does not create a new request when the male pet is admin-hidden', async () => {
    const prisma = {
      pet: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(activeFemale)
          .mockResolvedValueOnce({
            ...activeMale,
            status: PetStatus.HIDDEN,
            isAvailableForMatching: false,
          }),
      },
      $transaction: jest.fn(),
    };
    const service = new MatchingService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
      {} as NotificationsService,
    );

    await expect(
      service.createRequest(activeFemale.ownerId, {
        femalePetId: activeFemale.id,
        malePetId: activeMale.id,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('MatchingService moderation', () => {
  const userId = 'user-1';
  const otherUserId = 'user-2';
  const matchId = 'match-1';
  let tx: any;
  let prisma: any;
  let service: MatchingService;
  let notifications: { create: jest.Mock };

  beforeEach(() => {
    const match = {
      id: matchId,
      pet1Id: 'pet-1',
      pet2Id: 'pet-2',
      status: MatchStatus.ACTIVE,
      pet1: {
        id: 'pet-1',
        ownerId: userId,
        owner: { id: userId, name: 'User 1', email: 'user1@example.com' },
      },
      pet2: {
        id: 'pet-2',
        ownerId: otherUserId,
        owner: { id: otherUserId, name: 'User 2', email: 'user2@example.com' },
      },
    };
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      match: {
        findUnique: jest.fn().mockResolvedValue(match),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      matchingRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      petReport: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'report-1',
          targetType: 'USER',
          reason: 'HARASSMENT',
          detail: 'detail',
          createdAt: new Date(),
        }),
      },
      userBlock: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    prisma = {
      $transaction: jest.fn().mockImplementation((callback: (client: any) => unknown) => callback(tx)),
      match: { findUnique: jest.fn().mockResolvedValue(match) },
    };
    notifications = { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) };
    service = new MatchingService(
      prisma as PrismaService,
      {} as CloudinaryService,
      notifications as any,
    );
  });

  it('reports the other participant and creates an audit log', async () => {
    await service.reportMatch(userId, matchId, {
      targetType: 'USER',
      reason: 'HARASSMENT',
      detail: ' detail ',
    });

    expect(tx.petReport.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        matchId,
        userId,
        reportedUserId: otherUserId,
        petId: 'pet-2',
        targetType: 'USER',
        detail: 'detail',
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'USER_CREATE_MATCHING_REPORT' }),
    }));
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        title: 'PetMatch đã tiếp nhận phản ánh',
        targetUrl: '/notifications',
        entityId: 'report-1',
      }),
      tx,
    );
  });

  it('reports the other pet separately from its owner', async () => {
    await service.reportMatch(userId, matchId, {
      targetType: 'PET',
      reason: 'PET_SAFETY',
    });

    expect(tx.petReport.findUnique).toHaveBeenCalledWith({
      where: {
        matchId_userId_targetType: {
          matchId,
          userId,
          targetType: 'PET',
        },
      },
      select: { id: true },
    });
    expect(tx.petReport.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reportedUserId: otherUserId,
        petId: 'pet-2',
        targetType: 'PET',
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          targetType: 'PET',
          reportedPetId: 'pet-2',
        }),
      }),
    }));
  });

  it('rejects a report reason that does not match the selected target', async () => {
    await expect(
      service.reportMatch(userId, matchId, {
        targetType: 'PET',
        reason: 'HARASSMENT',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not create the same report twice for one match', async () => {
    tx.petReport.findUnique.mockResolvedValue({ id: 'report-1' });

    await expect(
      service.reportMatch(userId, matchId, {
        targetType: 'USER',
        reason: 'HARASSMENT',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.petReport.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not allow a non-participant to report a match', async () => {
    await expect(
      service.reportMatch('other-user', matchId, {
        targetType: 'USER',
        reason: 'HARASSMENT',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.petReport.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('blocks idempotently and closes pending matching interactions once', async () => {
    const result = await service.blockMatchUser(userId, matchId);

    expect(result).toEqual({ success: true, blockedUserId: otherUserId, alreadyBlocked: false });
    expect(tx.matchingRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.match.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);

    tx.userBlock.createMany.mockResolvedValue({ count: 0 });
    tx.matchingRequest.updateMany.mockClear();
    tx.match.updateMany.mockClear();
    tx.auditLog.create.mockClear();
    const repeated = await service.blockMatchUser(userId, matchId);

    expect(repeated.alreadyBlocked).toBe(true);
    expect(tx.matchingRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.match.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not allow a non-participant to block from a match', async () => {
    await expect(
      service.blockMatchUser('other-user', matchId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.userBlock.createMany).not.toHaveBeenCalled();
  });

  it('only removes a block created by the current user', async () => {
    await service.unblockUser(userId, otherUserId);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.userBlock.deleteMany).toHaveBeenCalledWith({
      where: { blockerId: userId, blockedId: otherUserId },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'USER_UNBLOCK' }),
    }));
  });

  it('handles repeated unblock requests without duplicate audit logs', async () => {
    tx.userBlock.deleteMany.mockResolvedValue({ count: 0 });

    const result = await service.unblockUser(userId, otherUserId);

    expect(result).toEqual({
      success: true,
      blockedUserId: otherUserId,
      wasBlocked: false,
    });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

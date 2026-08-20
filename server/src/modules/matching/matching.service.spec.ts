import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
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
      owner: { id: userId, name: 'User 1', email: 'user1@example.com' },
    },
    pet2: {
      id: 'pet-2',
      ownerId: 'user-2',
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
          pet1: { ownerId: userId },
          pet2: { ownerId: 'user-2' },
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

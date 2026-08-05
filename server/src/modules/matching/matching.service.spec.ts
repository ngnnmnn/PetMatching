import { NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MatchingService } from './matching.service';

type TransactionMock = {
  $queryRaw: jest.Mock;
  match: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  message: {
    create: jest.Mock;
  };
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
    };
    prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: TransactionMock) => unknown) =>
          Promise.resolve(callback(transaction)),
        ),
      match: { findFirst: jest.fn().mockResolvedValue({ id: matchId }) },
      message: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    cloudinary = {
      uploadBuffer: jest.fn().mockResolvedValue({ url: imageUrl }),
      destroyByUrl: jest.fn().mockResolvedValue(undefined),
    };
    service = new MatchingService(
      prisma as unknown as PrismaService,
      cloudinary as unknown as CloudinaryService,
      {} as MailService,
    );
  });

  it('locks the match before saving a text message', async () => {
    await service.sendMessage(userId, matchId, '  hello  ');

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

  it('saves a Cloudinary URL after locking an active match', async () => {
    await service.sendImageMessage(userId, matchId, {
      buffer: Buffer.from('image'),
      mimetype: 'image/png',
    });

    expect(prisma.match.findFirst).toHaveBeenCalledTimes(1);
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

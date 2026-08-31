import { PetStatus } from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MatchingService } from './matching.service';

describe('MatchingService deleted participant history', () => {
  it('keeps an ended Match readable with anonymous Pet and sender placeholders', async () => {
    const prisma = {
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'match-1',
            status: 'CANCELLED',
            pet1Id: null,
            pet2Id: 'pet-2',
            pet1OwnerId: 'user-1',
            pet2OwnerId: 'user-2',
            pet1: null,
            pet2: {
              id: 'pet-2',
              name: 'Luna',
              breed: 'Poodle',
              gender: 'FEMALE',
              avatarUrl: null,
              status: PetStatus.ACTIVE,
              owner: { id: 'user-2', name: 'Owner 2', avatarUrl: null },
            },
            messages: [
              {
                id: 'message-1',
                senderId: null,
                sender: null,
                content: 'Tin nhắn cũ',
                imageUrl: null,
                isRead: true,
                createdAt: new Date(),
              },
            ],
            reports: [],
            _count: { messages: 0 },
          },
        ]),
      },
      userBlock: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new MatchingService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
      {} as NotificationsService,
    );

    const [match] = await service.getMatches('user-1');

    expect(match.pet1).toMatchObject({
      id: null,
      name: 'Thú cưng đã xóa',
      isDeleted: true,
    });
    expect(match.pet2).toMatchObject({ id: 'pet-2', name: 'Luna' });
    expect(match.messages[0].sender).toEqual({
      id: null,
      name: 'Tài khoản đã xóa',
    });
  });
});

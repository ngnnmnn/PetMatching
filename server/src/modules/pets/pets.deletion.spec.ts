import { ConflictException } from '@nestjs/common';
import { MatchStatus, PaymentStatus, SpaBookingStatus } from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PetsService } from './pets.service';

describe('PetsService deletion policy', () => {
  const pet = {
    id: 'pet-1',
    ownerId: 'user-1',
    name: 'Milo',
    avatarUrl: 'https://res.cloudinary.com/demo/image/upload/pet.jpg',
    gallery: [],
    documents: [
      { imageUrls: ['https://res.cloudinary.com/demo/image/upload/doc.jpg'] },
    ],
  };

  function setup(activeBookings: unknown[] = []) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      spaBooking: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(activeBookings)
          .mockResolvedValueOnce([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      pet: {
        findMany: jest.fn().mockResolvedValue([pet]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      match: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      matchingRequest: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const cloudinary = { destroyByUrl: jest.fn().mockResolvedValue(undefined) };
    const service = new PetsService(
      prisma as unknown as PrismaService,
      cloudinary as unknown as CloudinaryService,
    );
    return { service, tx, cloudinary };
  }

  it('cancels pending Spa bookings, ends matches and deletes the owned pet', async () => {
    const { service, tx, cloudinary } = setup([
      {
        id: 'spa-1',
        status: SpaBookingStatus.PENDING,
        scheduledAt: new Date(),
        payment: { status: PaymentStatus.PENDING },
      },
    ]);

    await expect(service.deletePet('user-1', 'pet-1')).resolves.toMatchObject({
      success: true,
      cancelledSpaBookings: 1,
      cancelledMatchingRequests: 3,
      endedMatches: 2,
    });
    expect(tx.spaBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SpaBookingStatus.CANCELLED }),
      }),
    );
    expect(tx.match.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MatchStatus.CANCELLED,
          endReason: 'PET_DELETED',
        }),
      }),
    );
    expect(tx.pet.deleteMany).toHaveBeenCalled();
    expect(cloudinary.destroyByUrl).toHaveBeenCalledTimes(2);
  });

  it('blocks deletion when a Spa booking is confirmed', async () => {
    const { service, tx } = setup([
      {
        id: 'spa-1',
        status: SpaBookingStatus.CONFIRMED,
        scheduledAt: new Date(),
        payment: { status: PaymentStatus.PENDING },
      },
    ]);

    await expect(service.deletePet('user-1', 'pet-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.pet.deleteMany).not.toHaveBeenCalled();
  });
});

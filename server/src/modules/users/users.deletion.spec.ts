import { ConflictException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentService } from '../payment/payment.service';
import { PetsService } from '../pets/pets.service';
import { UsersService } from './users.service';

describe('UsersService account deletion policy', () => {
  function setup(blockingOrders: unknown[] = []) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          role: UserRole.USER,
          avatarUrl: null,
          pets: [{ id: 'pet-1' }],
        }),
        delete: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      order: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(blockingOrders)
          .mockResolvedValueOnce([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      spaBooking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      message: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      match: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      complaint: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      matchingRequest: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const petsService = {
      prepareSpaBookingsForDeletion: jest.fn().mockResolvedValue({
        cancelledSpaBookings: 1,
        mediaUrls: [],
      }),
      deleteOwnedPetsInTransaction: jest.fn().mockResolvedValue({
        cancelledMatchingRequests: 2,
        endedMatches: 1,
        mediaUrls: [],
      }),
    };
    const cloudinary = { destroyByUrl: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      {} as PaymentService,
      cloudinary as unknown as CloudinaryService,
      {} as NotificationsService,
      petsService as unknown as PetsService,
    );
    return { service, tx, petsService };
  }

  it('blocks account deletion while a Store order is unfinished', async () => {
    const { service, tx } = setup([
      {
        id: 'order-1',
        status: OrderStatus.SHIPPED,
        refundStatus: null,
        createdAt: new Date(),
      },
    ]);

    await expect(service.deleteAccount('user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it('detaches completed histories and hard deletes the account', async () => {
    const { service, tx, petsService } = setup();

    await expect(service.deleteAccount('user-1')).resolves.toMatchObject({
      success: true,
      cancelledSpaBookings: 1,
      cancelledMatchingRequests: 2,
      endedMatches: 1,
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: OrderStatus.DELIVERED },
      data: { userId: null },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          status: { not: OrderStatus.DELIVERED },
        },
        data: expect.objectContaining({
          userId: null,
          customerNameSnapshot: null,
          shippingAddress: 'Thông tin người nhận đã được ẩn',
          deliveryProofUrl: null,
        }),
      }),
    );
    expect(tx.spaBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: null } }),
    );
    expect(petsService.deleteOwnedPetsInTransaction).toHaveBeenCalled();
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });
});

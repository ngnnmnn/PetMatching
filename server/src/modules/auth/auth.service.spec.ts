import { UnauthorizedException } from '@nestjs/common';
import {
  AccountStatus,
  ComplaintAction,
  ComplaintStatus,
} from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService suspended accounts', () => {
  it('shows the matching-report reason when a suspended user signs in', async () => {
    const usersService = {
      validateUser: jest.fn().mockResolvedValue({
        id: 'reported-1',
        email: 'reported@example.com',
        name: 'Reported User',
        role: 'USER',
        accountStatus: AccountStatus.SUSPENDED,
      }),
    };
    const prisma = {
      petReport: {
        findFirst: jest.fn().mockResolvedValue({
          reason: 'HARASSMENT',
          resolvedAt: new Date(),
          createdAt: new Date(),
        }),
      },
      auditLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AuthService(
      usersService as any,
      {} as any,
      prisma as any,
      {} as any,
    );

    const error = await service
      .login({ identifier: 'reported@example.com', password: 'password' })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('quấy rối người dùng khác'),
      }),
    );
    expect(prisma.petReport.findFirst).toHaveBeenCalledWith({
      where: {
        reportedUserId: 'reported-1',
        status: ComplaintStatus.RESOLVED,
        actionTaken: ComplaintAction.SUSPEND_ACCOUNT,
      },
      orderBy: [{ resolvedAt: 'desc' }, { createdAt: 'desc' }],
      select: { reason: true, resolvedAt: true, createdAt: true },
    });
  });
});

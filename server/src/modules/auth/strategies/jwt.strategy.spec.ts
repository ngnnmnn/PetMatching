import { UnauthorizedException } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy suspended accounts', () => {
  it('blocks an existing session and returns the suspension reason', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reported-1',
          email: 'reported@example.com',
          name: 'Reported User',
          role: 'USER',
          accountStatus: AccountStatus.SUSPENDED,
        }),
      },
      petReport: {
        findFirst: jest.fn().mockResolvedValue({
          reason: 'FAKE_INFORMATION',
          resolvedAt: new Date(),
          createdAt: new Date(),
        }),
      },
      auditLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const strategy = new JwtStrategy(prisma as any);

    const error = await strategy
      .validate({ sub: 'reported-1' })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getResponse()).toEqual({
      code: 'ACCOUNT_SUSPENDED',
      message: expect.stringContaining('cung cấp thông tin giả'),
    });
  });
});

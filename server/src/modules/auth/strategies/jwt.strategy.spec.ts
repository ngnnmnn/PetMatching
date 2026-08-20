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
    };
    const strategy = new JwtStrategy(prisma as any);

    const error = await strategy
      .validate({ sub: 'reported-1' })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getResponse()).toEqual({
      code: 'ACCOUNT_SUSPENDED',
      message: expect.stringContaining('vi phạm tiêu chuẩn cộng đồng'),
    });
  });
});

import { UnauthorizedException } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService suspended accounts', () => {
  it('shows the community standards message when a suspended user signs in', async () => {
    const usersService = {
      validateUser: jest.fn().mockResolvedValue({
        id: 'reported-1',
        email: 'reported@example.com',
        name: 'Reported User',
        role: 'USER',
        accountStatus: AccountStatus.SUSPENDED,
      }),
    };
    const service = new AuthService(
      usersService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const error = await service
      .login({ identifier: 'reported@example.com', password: 'password' })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('vi phạm tiêu chuẩn cộng đồng'),
      }),
    );
  });
});

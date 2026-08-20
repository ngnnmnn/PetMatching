import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { COMMUNITY_STANDARDS_BLOCK_MESSAGE } from '../../../common/matching-report-reason';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your_secret_key_here',
    });
  }

  async validate(payload: {
    sub?: string;
    email?: string;
    role?: string;
    accountStatus?: string;
    name?: string;
    purpose?: string;
  }) {
    if (!payload.sub || payload.purpose) {
      throw new UnauthorizedException('Token đăng nhập không hợp lệ.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Tài khoản không còn tồn tại.',
      });
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_SUSPENDED',
        message: COMMUNITY_STANDARDS_BLOCK_MESSAGE,
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      name: user.name,
    };
  }
}

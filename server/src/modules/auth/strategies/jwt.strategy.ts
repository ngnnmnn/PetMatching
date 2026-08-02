import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your_secret_key_here',
    });
  }

  validate(payload: {
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

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      accountStatus: payload.accountStatus,
      name: payload.name,
    };
  }
}

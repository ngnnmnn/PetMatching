import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus } from '@prisma/client';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  accountStatus?: string;
  avatarUrl?: string | null;
  phone?: string | null;
  isVerified?: boolean;
};

type GoogleTokenResponse = {
  access_token?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  private readonly otpExpiryMs = 5 * 60 * 1000;
  private readonly resendCooldownMs = 30 * 1000;
  private readonly maxOtpAttempts = 5;
  private readonly otpLockDurationMs = 15 * 60 * 1000;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  private buildAuthResponse(user: AuthUser, message: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      name: user.name,
    };

    return {
      success: true,
      message,
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accountStatus: user.accountStatus,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        isVerified: user.isVerified,
      },
    };
  }

  private getOtpLockMessage(lockedUntil: Date, now = new Date()) {
    const remainingMs = Math.max(lockedUntil.getTime() - now.getTime(), 0);
    const remainingMinutes = Math.floor(remainingMs / 60_000);
    const remainingSeconds = Math.ceil((remainingMs % 60_000) / 1000);

    if (remainingMinutes > 0) {
      return `Tài khoản đang bị khóa do nhập sai OTP quá nhiều lần. Vui lòng thử lại sau ${remainingMinutes} phút ${remainingSeconds} giây.`;
    }

    return `Tài khoản đang bị khóa do nhập sai OTP quá nhiều lần. Vui lòng thử lại sau ${remainingSeconds} giây.`;
  }

  private async ensureOtpAccountNotLocked(user: {
    id: string;
    failedOtpAttempts?: number | null;
    lockedUntil?: Date | null;
  }) {
    if (!user.lockedUntil) {
      return user.failedOtpAttempts ?? 0;
    }

    const now = new Date();
    if (user.lockedUntil.getTime() > now.getTime()) {
      throw new BadRequestException(
        this.getOtpLockMessage(user.lockedUntil, now),
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedOtpAttempts: 0,
        lockedUntil: null,
      },
    });

    return 0;
  }

  private async lockOtpAccount(userId: string) {
    const lockedUntil = new Date(Date.now() + this.otpLockDurationMs);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedOtpAttempts: this.maxOtpAttempts,
        lockedUntil,
      },
    });

    return lockedUntil;
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng!');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new UnauthorizedException('Tai khoan dang bi khoa.');
    }

    if (!user.isVerified) {
      await this.ensureOtpAccountNotLocked(user);
      await this.createAndSendOtp(user.email);

      throw new UnauthorizedException({
        message: 'Vui lòng xác thực email trước khi đăng nhập.',
        requiresVerification: true,
        email: user.email,
      });
    }

    return this.buildAuthResponse(user, 'Đăng nhập thành công!');
  }

  async register(registerDto: RegisterDto) {
    await this.usersService.createUser({
      email: registerDto.email,
      password: registerDto.password,
      name: registerDto.name,
      phone: registerDto.phone,
      avatarUrl: registerDto.avatarUrl,
    });

    await this.createAndSendOtp(registerDto.email);

    return {
      success: true,
      message:
        'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP.',
      requiresVerification: true,
      email: registerDto.email,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const email = verifyEmailDto.email;
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Email chưa được đăng ký.');
    }

    const currentFailedOtpAttempts =
      await this.ensureOtpAccountNotLocked(user);

    const latestOtp = await this.prisma.emailOtp.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestOtp) {
      throw new BadRequestException(
        'Không tìm thấy mã OTP. Vui lòng gửi lại mã.',
      );
    }

    if (
      currentFailedOtpAttempts < this.maxOtpAttempts &&
      latestOtp.attempts >= this.maxOtpAttempts
    ) {
      await this.lockOtpAccount(user.id);
      throw new BadRequestException(
        'Bạn đã nhập sai OTP 5 lần liên tiếp. Tài khoản đã bị khóa trong 15 phút.',
      );
    }

    if (latestOtp.usedAt) {
      throw new BadRequestException('Mã OTP đã được sử dụng.');
    }

    if (latestOtp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Mã OTP đã hết hạn.');
    }

    const isOtpValid = await bcrypt.compare(
      verifyEmailDto.otp,
      latestOtp.codeHash,
    );

    if (!isOtpValid) {
      const failedOtpAttempts = currentFailedOtpAttempts + 1;
      const isLocked = failedOtpAttempts >= this.maxOtpAttempts;
      const lockedUntil = isLocked
        ? new Date(Date.now() + this.otpLockDurationMs)
        : null;

      await this.prisma.$transaction([
        this.prisma.emailOtp.update({
          where: { id: latestOtp.id },
          data: { attempts: latestOtp.attempts + 1 },
        }),
        this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedOtpAttempts,
            lockedUntil,
          },
        }),
      ]);

      if (isLocked && lockedUntil) {
        throw new BadRequestException(
          'Bạn đã nhập sai OTP 5 lần liên tiếp. Tài khoản đã bị khóa trong 15 phút.',
        );
      }

      const remainingAttempts = Math.max(
        this.maxOtpAttempts - failedOtpAttempts,
        0,
      );
      throw new BadRequestException(
        `Mã OTP không đúng. Bạn còn ${remainingAttempts} lần thử.`,
      );
    }

    const verifiedUser = await this.prisma.$transaction(async (tx) => {
      await tx.emailOtp.update({
        where: { id: latestOtp.id },
        data: { usedAt: new Date() },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          failedOtpAttempts: 0,
          lockedUntil: null,
        },
      });

      const { passwordHash, ...result } = updatedUser;
      return result;
    });

    return this.buildAuthResponse(
      verifiedUser,
      'Xác thực email thành công!',
    );
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const user = await this.usersService.findByEmail(resendOtpDto.email);
    if (!user) {
      throw new BadRequestException('Email chưa được đăng ký.');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email đã được xác thực.');
    }

    await this.ensureOtpAccountNotLocked(user);

    const latestOtp = await this.prisma.emailOtp.findFirst({
      where: { email: resendOtpDto.email },
      orderBy: { lastSentAt: 'desc' },
    });

    if (latestOtp) {
      if (
        (user.failedOtpAttempts ?? 0) < this.maxOtpAttempts &&
        latestOtp.attempts >= this.maxOtpAttempts
      ) {
        await this.lockOtpAccount(user.id);
        throw new BadRequestException(
          'Bạn đã nhập sai OTP 5 lần liên tiếp. Tài khoản đã bị khóa trong 15 phút.',
        );
      }

      const elapsedMs = Date.now() - latestOtp.lastSentAt.getTime();
      if (elapsedMs < this.resendCooldownMs) {
        const waitSeconds = Math.ceil(
          (this.resendCooldownMs - elapsedMs) / 1000,
        );
        throw new BadRequestException(
          `Vui lòng chờ ${waitSeconds} giây trước khi gửi lại mã.`,
        );
      }
    }

    await this.createAndSendOtp(resendOtpDto.email);

    return {
      success: true,
      message: 'Mã OTP mới đã được gửi đến email của bạn.',
    };
  }

  private generateOtp() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async createAndSendOtp(email: string) {
    const otp = this.generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.emailOtp.updateMany({
        where: { email, usedAt: null },
        data: { usedAt: now },
      });

      await tx.emailOtp.create({
        data: {
          email,
          codeHash,
          expiresAt: new Date(now.getTime() + this.otpExpiryMs),
          lastSentAt: now,
        },
      });
    });

    await this.mailService.sendOtpEmail(email, otp);
  }

  getGoogleAuthUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('Missing GOOGLE_CLIENT_ID');
    }

    const redirectUri =
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:5000/api/auth/google/callback';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async googleLogin(code: string) {
    if (!code) {
      throw new BadRequestException('Missing Google authorization code');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:5000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
      );
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new BadGatewayException(
        tokenData.error_description || 'Không thể xác thực với Google',
      );
    }

    const userInfoResponse = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;
    if (!userInfoResponse.ok || !googleUser.email) {
      throw new BadGatewayException(
        'Không thể lấy thông tin tài khoản Google',
      );
    }

    if (googleUser.email_verified === false) {
      throw new UnauthorizedException('Email Google chưa được xác minh');
    }

    const existingUser = await this.usersService.findByEmail(googleUser.email);
    const user = existingUser
      ? await this.usersService.updateGoogleProfile(existingUser.id, {
          name: existingUser.name || googleUser.name || googleUser.email,
          googleId: googleUser.sub,
          avatarUrl: existingUser.avatarUrl || googleUser.picture,
          isVerified: true,
        })
      : await this.usersService.createGoogleUser({
          email: googleUser.email,
          name: googleUser.name || googleUser.email,
          googleId: googleUser.sub,
          avatarUrl: googleUser.picture,
        });

    return this.buildAuthResponse(user, 'Đăng nhập Google thành công!');
  }

  async verify(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.usersService.findById(decoded.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      if (user.accountStatus === AccountStatus.SUSPENDED) {
        throw new UnauthorizedException('Account suspended');
      }
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          accountStatus: user.accountStatus,
          avatarUrl: user.avatarUrl,
          phone: user.phone,
          isVerified: user.isVerified,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { CompleteGoogleProfileDto } from './dto/complete-google-profile.dto';

type AuthUser = {
  id: string;
  email: string;
  username?: string | null;
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

type GoogleOnboardingPayload = {
  purpose: 'google-onboarding';
  googleId: string;
  email: string;
  suggestedName: string;
  avatarUrl?: string;
  userId?: string;
  needsPassword: boolean;
};

type GoogleOnboardingInput = Omit<GoogleOnboardingPayload, 'purpose'>;

type GoogleLoginResult =
  | {
      requiresProfileCompletion: true;
      profileToken: string;
      email: string;
      suggestedName: string;
      needsPassword: boolean;
    }
  | ReturnType<AuthService['buildAuthResponse']>;

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
      username: user.username,
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
        username: user.username,
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
      loginDto.identifier,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException(
        'Email/tên đăng nhập hoặc mật khẩu không đúng!',
      );
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
    const email = registerDto.email.trim().toLowerCase();
    await this.usersService.createUser({
      email,
      username: registerDto.username,
      password: registerDto.password,
      name: registerDto.name,
      phone: registerDto.phone,
      avatarUrl: registerDto.avatarUrl,
    });

    await this.createAndSendOtp(email);

    return {
      success: true,
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP.',
      requiresVerification: true,
      email,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const email = verifyEmailDto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Email chưa được đăng ký.');
    }

    const currentFailedOtpAttempts = await this.ensureOtpAccountNotLocked(user);

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

      return tx.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          failedOtpAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    return this.buildAuthResponse(verifiedUser, 'Xác thực email thành công!');
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const email = resendOtpDto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Email chưa được đăng ký.');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email đã được xác thực.');
    }

    await this.ensureOtpAccountNotLocked(user);

    const latestOtp = await this.prisma.emailOtp.findFirst({
      where: { email },
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

    await this.createAndSendOtp(email);

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

  getGoogleAuthUrl(redirect?: string) {
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

    if (redirect) {
      params.append('state', redirect);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async googleLogin(code: string): Promise<GoogleLoginResult> {
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
    if (!userInfoResponse.ok || !googleUser.email || !googleUser.sub) {
      throw new BadGatewayException('Không thể lấy thông tin tài khoản Google');
    }

    if (googleUser.email_verified !== true) {
      throw new UnauthorizedException('Email Google chưa được xác minh');
    }

    const email = googleUser.email.trim().toLowerCase();
    const suggestedName = googleUser.name || email;
    const userByGoogleId = await this.usersService.findByGoogleId(
      googleUser.sub,
    );

    if (userByGoogleId) {
      this.ensureAccountActive(userByGoogleId.accountStatus);
      if (userByGoogleId.username && userByGoogleId.passwordHash) {
        return this.buildAuthResponse(
          userByGoogleId,
          'Đăng nhập Google thành công!',
        );
      }
      return this.buildGoogleOnboardingResponse({
        googleId: googleUser.sub,
        email,
        suggestedName: userByGoogleId.name || suggestedName,
        avatarUrl: userByGoogleId.avatarUrl || googleUser.picture,
        userId: userByGoogleId.id,
        needsPassword: !userByGoogleId.passwordHash,
      });
    }

    const userByEmail = await this.usersService.findByEmail(email);
    if (userByEmail) {
      this.ensureAccountActive(userByEmail.accountStatus);
      if (userByEmail.googleId && userByEmail.googleId !== googleUser.sub) {
        throw new ConflictException(
          'Email này đã được liên kết với một tài khoản Google khác.',
        );
      }

      const linkedUser = await this.usersService.updateGoogleProfile(
        userByEmail.id,
        {
          googleId: googleUser.sub,
          avatarUrl: userByEmail.avatarUrl || googleUser.picture,
          isVerified: true,
        },
      );
      if (linkedUser.username && userByEmail.passwordHash) {
        return this.buildAuthResponse(
          linkedUser,
          'Liên kết và đăng nhập Google thành công!',
        );
      }
      return this.buildGoogleOnboardingResponse({
        googleId: googleUser.sub,
        email,
        suggestedName: linkedUser.name || suggestedName,
        avatarUrl: linkedUser.avatarUrl || googleUser.picture,
        userId: linkedUser.id,
        needsPassword: !userByEmail.passwordHash,
      });
    }

    return this.buildGoogleOnboardingResponse({
      googleId: googleUser.sub,
      email,
      suggestedName,
      avatarUrl: googleUser.picture,
      needsPassword: true,
    });
  }

  async completeGoogleProfile(dto: CompleteGoogleProfileDto) {
    const payload = this.verifyGoogleOnboardingToken(dto.profileToken);
    const username = dto.username.trim().toLowerCase();
    const name = dto.name.trim();

    if (['admin', 'support', 'manager', 'api'].includes(username)) {
      throw new BadRequestException(
        'Tên đăng nhập này không được phép sử dụng.',
      );
    }
    let passwordHash: string | undefined;
    if (payload.needsPassword) {
      if (!dto.password || dto.password !== dto.confirmPassword) {
        throw new BadRequestException('Mật khẩu xác nhận không khớp.');
      }
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const usernameOwner = await this.usersService.findByUsername(username);
    if (usernameOwner && usernameOwner.id !== payload.userId) {
      throw new ConflictException('Tên đăng nhập đã được sử dụng.');
    }

    if (!payload.userId && !passwordHash) {
      throw new BadRequestException('Mật khẩu là bắt buộc.');
    }
    const requiredPasswordHash = passwordHash;

    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        if (payload.userId) {
          const updated = await tx.user.updateMany({
            where: {
              id: payload.userId,
              OR: [{ username: null }, { passwordHash: null }],
            },
            data: {
              username,
              name,
              googleId: payload.googleId,
              avatarUrl: payload.avatarUrl,
              isVerified: true,
              ...(passwordHash ? { passwordHash } : {}),
            },
          });
          if (updated.count !== 1) {
            throw new ConflictException('Tài khoản đã được hoàn tất trước đó.');
          }
          const completedUser = await tx.user.findUnique({
            where: { id: payload.userId },
          });
          if (!completedUser) {
            throw new UnauthorizedException('Tài khoản không còn tồn tại.');
          }
          return completedUser;
        }

        return tx.user.create({
          data: {
            email: payload.email,
            username,
            passwordHash: requiredPasswordHash,
            googleId: payload.googleId,
            name,
            avatarUrl: payload.avatarUrl,
            isVerified: true,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email, tên đăng nhập hoặc tài khoản Google đã được sử dụng.',
        );
      }
      throw error;
    }

    return this.buildAuthResponse(user, 'Hoàn tất tài khoản thành công!');
  }

  private buildGoogleOnboardingResponse(payload: GoogleOnboardingInput) {
    const profileToken = this.jwtService.sign(
      { ...payload, purpose: 'google-onboarding' },
      { expiresIn: '10m' },
    );
    return {
      requiresProfileCompletion: true as const,
      profileToken,
      email: payload.email,
      suggestedName: payload.suggestedName,
      needsPassword: payload.needsPassword,
    };
  }

  private verifyGoogleOnboardingToken(token: string): GoogleOnboardingPayload {
    try {
      const payload = this.jwtService.verify<GoogleOnboardingPayload>(token);
      if (payload.purpose !== 'google-onboarding') throw new Error();
      return payload;
    } catch {
      throw new UnauthorizedException(
        'Phiên hoàn thiện tài khoản đã hết hạn. Vui lòng đăng nhập Google lại.',
      );
    }
  }

  private ensureAccountActive(accountStatus?: string) {
    if (accountStatus === AccountStatus.SUSPENDED) {
      throw new UnauthorizedException('Tài khoản đang bị khóa.');
    }
  }

  async verify(token: string) {
    try {
      const decoded = this.jwtService.verify<{ sub: string }>(token);
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
          username: user.username,
          name: user.name,
          role: user.role,
          accountStatus: user.accountStatus,
          avatarUrl: user.avatarUrl,
          phone: user.phone,
          isVerified: user.isVerified,
        },
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

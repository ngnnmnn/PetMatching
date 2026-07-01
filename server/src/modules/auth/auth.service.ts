import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  phone?: string | null;
  isVerified?: boolean;
};

type GoogleTokenResponse = {
  access_token?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  private buildAuthResponse(user: AuthUser, message: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
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
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        isVerified: user.isVerified,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng!');
    }

    return this.buildAuthResponse(user, 'Đăng nhập thành công!');
  }

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.createUser({
      email: registerDto.email,
      password: registerDto.password,
      name: registerDto.name,
      phone: registerDto.phone,
      avatarUrl: registerDto.avatarUrl,
    });

    return this.buildAuthResponse(user, 'Đăng ký thành công!');
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
      throw new BadGatewayException('Không thể lấy thông tin tài khoản Google');
    }

    if (googleUser.email_verified === false) {
      throw new UnauthorizedException('Email Google chưa được xác minh');
    }

    const existingUser = await this.usersService.findByEmail(googleUser.email);
    const user = existingUser
      ? await this.usersService.updateGoogleProfile(existingUser.id, {
          name: existingUser.name || googleUser.name || googleUser.email,
          avatarUrl: existingUser.avatarUrl || googleUser.picture,
          isVerified: true,
        })
      : await this.usersService.createGoogleUser({
          email: googleUser.email,
          name: googleUser.name || googleUser.email,
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
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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

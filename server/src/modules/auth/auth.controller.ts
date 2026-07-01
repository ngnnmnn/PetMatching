import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.resendOtp(resendOtpDto);
  }

  @Get('google')
  async googleAuth(@Res() res: Response) {
    return res.redirect(this.authService.getGoogleAuthUrl());
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const clientUrl =
      process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';

    if (error) {
      return res.redirect(
        `${clientUrl}/auth/google/callback?error=${encodeURIComponent(error)}`,
      );
    }

    try {
      const authResult = await this.authService.googleLogin(code);
      const params = new URLSearchParams({ token: authResult.accessToken });

      return res.redirect(
        `${clientUrl}/auth/google/callback?${params.toString()}`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Đăng nhập Google thất bại';

      return res.redirect(
        `${clientUrl}/auth/google/callback?error=${encodeURIComponent(message)}`,
      );
    }
  }

  @Get('verify')
  async verify(@Headers('authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    return this.authService.verify(token);
  }
}

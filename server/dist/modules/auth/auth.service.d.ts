import { JwtService } from '@nestjs/jwt';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
export declare class AuthService {
    private usersService;
    private jwtService;
    private prisma;
    private mailService;
    private readonly otpExpiryMs;
    private readonly resendCooldownMs;
    private readonly maxOtpAttempts;
    constructor(usersService: UsersService, jwtService: JwtService, prisma: PrismaService, mailService: MailService);
    private buildAuthResponse;
    login(loginDto: LoginDto): Promise<{
        success: boolean;
        message: string;
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            avatarUrl: string | null | undefined;
            phone: string | null | undefined;
            isVerified: boolean | undefined;
        };
    }>;
    register(registerDto: RegisterDto): Promise<{
        success: boolean;
        message: string;
        requiresVerification: boolean;
        email: string;
    }>;
    verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{
        success: boolean;
        message: string;
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            avatarUrl: string | null | undefined;
            phone: string | null | undefined;
            isVerified: boolean | undefined;
        };
    }>;
    resendOtp(resendOtpDto: ResendOtpDto): Promise<{
        success: boolean;
        message: string;
    }>;
    private generateOtp;
    private createAndSendOtp;
    getGoogleAuthUrl(): string;
    googleLogin(code: string): Promise<{
        success: boolean;
        message: string;
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            avatarUrl: string | null | undefined;
            phone: string | null | undefined;
            isVerified: boolean | undefined;
        };
    }>;
    verify(token: string): Promise<{
        success: boolean;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            avatarUrl: string | null | undefined;
            phone: string | null | undefined;
            isVerified: boolean | undefined;
        };
    }>;
}

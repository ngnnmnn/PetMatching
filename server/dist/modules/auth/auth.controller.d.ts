import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
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
    googleAuth(res: Response): Promise<void>;
    googleCallback(code: string, error: string, res: Response): Promise<void>;
    verify(authHeader: string): Promise<{
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

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
    verify(authHeader: string): Promise<{
        success: boolean;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            avatarUrl: string | null | undefined;
            isVerified: boolean | undefined;
        };
    }>;
}

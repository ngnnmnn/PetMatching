import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private usersService;
    private jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
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
    verify(token: string): Promise<{
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

import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
type User = {
    id: string;
    email: string;
    passwordHash: string | null;
    name: string;
    phone?: string | null;
    avatarUrl?: string | null;
    role: string;
    isVerified?: boolean;
    createdAt: Date;
    refreshToken?: string | null;
};
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    validateUser(email: string, password: string): Promise<Omit<User, 'passwordHash'> | null>;
    createUser(data: {
        email: string;
        password: string;
        name: string;
        phone?: string;
        avatarUrl?: string;
        role?: UserRole;
    }): Promise<Omit<User, 'passwordHash'>>;
    createGoogleUser(data: {
        email: string;
        name: string;
        avatarUrl?: string;
    }): Promise<Omit<User, 'passwordHash'>>;
    updateGoogleProfile(userId: string, data: {
        name?: string;
        avatarUrl?: string;
        isVerified?: boolean;
    }): Promise<Omit<User, 'passwordHash'>>;
    updateRefreshToken(userId: string, refreshToken: string | null): Promise<{
        name: string;
        id: string;
        email: string;
        googleId: string | null;
        passwordHash: string | null;
        avatarUrl: string | null;
        phone: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        isVerified: boolean;
        refreshToken: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    markEmailVerified(userId: string): Promise<Omit<User, 'passwordHash'>>;
    getAllUsers(): Promise<{
        name: string;
        id: string;
        email: string;
        avatarUrl: string | null;
        phone: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        isVerified: boolean;
        createdAt: Date;
    }[]>;
}
export {};

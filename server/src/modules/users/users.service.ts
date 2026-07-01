import { ConflictException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
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

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;
    if (!user.passwordHash) return null;

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;

    const { passwordHash, ...result } = user;
    return result;
  }

  async createUser(data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    avatarUrl?: string;
    role?: UserRole;
  }): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('Email đã được đăng ký!');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        name: data.name,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        role: data.role ?? UserRole.USER,
        isVerified: false,
      },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  async createGoogleUser(data: {
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('Email đã được đăng ký!');
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        name: data.name,
        avatarUrl: data.avatarUrl,
        isVerified: true,
        role: UserRole.USER,
      },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  async updateGoogleProfile(
    userId: string,
    data: {
      name?: string;
      avatarUrl?: string;
      isVerified?: boolean;
    },
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  async markEmailVerified(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
        phone: true,
        avatarUrl: true,
      },
    });
  }
}

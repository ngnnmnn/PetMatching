import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type User = {
  id: string;
  email: string;
  googleId?: string | null;
  passwordHash: string | null;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  isVerified?: boolean;
  failedOtpAttempts?: number;
  lockedUntil?: Date | null;
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
    googleId?: string;
    avatarUrl?: string;
  }): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('Email đã được đăng ký!');
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        googleId: data.googleId,
        passwordHash: null,
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
      googleId?: string;
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

  private withoutPassword(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...result } = user;
    return result;
  }

  async getProfileWithStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            pets: true,
            orders: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Khong tim thay tai khoan.');
    }

    const { passwordHash, refreshToken, ...profile } = user;
    const totalSpent = user.orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0,
    );

    return {
      ...profile,
      stats: {
        pets: user._count.pets,
        orders: user._count.orders,
        totalSpent,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });

    return this.withoutPassword(user);
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Khong tim thay tai khoan.');
    }

    if (user.googleId || !user.passwordHash) {
      throw new BadRequestException(
        'Tai khoan Google khong the doi mat khau tai day.',
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Mat khau hien tai khong dung.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true };
  }

  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const addressCount = await tx.address.count({ where: { userId } });
      const shouldBeDefault = dto.isDefault || addressCount === 0;

      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          ...dto,
          userId,
          isDefault: shouldBeDefault,
        },
      });
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.ensureAddressOwner(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: dto,
      });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.ensureAddressOwner(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });

    if (address.isDefault) {
      const nextAddress = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (nextAddress) {
        await this.prisma.address.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return { success: true };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    await this.ensureAddressOwner(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }

  private async ensureAddressOwner(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Khong tim thay dia chi.');
    }

    return address;
  }
}

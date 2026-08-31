import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationCategory,
  NotificationEventType,
  OrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentService } from '../payment/payment.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PetsService } from '../pets/pets.service';

type User = {
  id: string;
  email: string;
  username?: string | null;
  googleId?: string | null;
  passwordHash: string | null;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  accountStatus?: string;
  isVerified?: boolean;
  failedOtpAttempts?: number;
  lockedUntil?: Date | null;
  createdAt: Date;
  refreshToken?: string | null;
};

function cleanItemNameForPayOS(name: string): string {
  let str = name;
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Y|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return str
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .substring(0, 50)
    .trim();
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
    private cloudinary: CloudinaryService,
    private readonly notifications: NotificationsService,
    private readonly petsService: PetsService,
  ) {}

  private async syncProductStockTx(tx: any, productId: string) {
    const variants = await tx.productVariant.findMany({
      where: { productId },
    });
    const totalStock = variants.reduce((sum: number, v: any) => sum + v.stock, 0);
    await tx.product.update({
      where: { id: productId },
      data: { stock: totalStock },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async validateUser(
    identifier: string,
    password: string,
  ): Promise<Omit<User, 'passwordHash'> | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = normalizedIdentifier.includes('@')
      ? await this.findByEmail(normalizedIdentifier)
      : await this.findByUsername(normalizedIdentifier);
    if (!user) return null;
    if (!user.passwordHash) return null;

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;

    const { passwordHash, ...result } = user;
    return result;
  }

  async createUser(data: {
    email: string;
    username: string;
    password: string;
    name: string;
    phone?: string;
    avatarUrl?: string;
    role?: UserRole;
  }): Promise<Omit<User, 'passwordHash'>> {
    const email = data.email.trim().toLowerCase();
    const username = data.username.trim().toLowerCase();
    const [existingUser, existingUsername] = await Promise.all([
      this.findByEmail(email),
      this.findByUsername(username),
    ]);
    if (existingUser) {
      if (existingUser.isVerified) {
        throw new ConflictException('Email đã được đăng ký!');
      }
      if (existingUsername && existingUsername.id !== existingUser.id) {
        throw new ConflictException('Tên đăng nhập đã được sử dụng!');
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      const updatedUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          username,
          passwordHash,
          name: data.name,
          phone: data.phone,
          avatarUrl: data.avatarUrl,
        },
      });
      const { passwordHash: _, ...result } = updatedUser;
      return result;
    }
    if (existingUsername) {
      throw new ConflictException('Tên đăng nhập đã được sử dụng!');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
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
        accountStatus: true,
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
    const previous =
      dto.avatarUrl !== undefined
        ? await this.prisma.user.findUnique({
            where: { id: userId },
            select: { avatarUrl: true },
          })
        : null;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });

    if (previous?.avatarUrl && previous.avatarUrl !== user.avatarUrl) {
      await this.cloudinary.destroyByUrl(previous.avatarUrl);
    }

    return this.withoutPassword(user);
  }

  async deleteAccount(userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`,
      );
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          avatarUrl: true,
          pets: { select: { id: true } },
        },
      });
      if (!user) {
        throw new NotFoundException('Không tìm thấy tài khoản.');
      }
      if (user.role !== UserRole.USER) {
        throw new ConflictException({
          code: 'USER_ROLE_MUST_BE_REVOKED',
          message:
            'Vui lòng chuyển giao hoặc thu hồi vai trò quản lý/nhân viên trước khi xóa tài khoản.',
        });
      }

      const blockingOrders = await tx.order.findMany({
        where: {
          userId,
          OR: [
            {
              status: {
                in: [
                  OrderStatus.PENDING,
                  OrderStatus.PACKED,
                  OrderStatus.PROCESSING,
                  OrderStatus.SHIPPED,
                ],
              },
            },
            { refundStatus: 'PENDING' },
          ],
        },
        select: { id: true, status: true, refundStatus: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      if (blockingOrders.length > 0) {
        throw new ConflictException({
          code: 'USER_HAS_ACTIVE_STORE_ORDERS',
          message:
            'Không thể xóa tài khoản vì bạn còn đơn hàng hoặc yêu cầu hoàn tiền chưa hoàn tất.',
          orders: blockingOrders,
        });
      }

      const petIds = user.pets.map((pet) => pet.id);
      const spa = await this.petsService.prepareSpaBookingsForDeletion(
        tx,
        {
          OR: [
            { userId },
            ...(petIds.length > 0 ? [{ petId: { in: petIds } }] : []),
          ],
        },
        'USER',
      );

      const [nonCompletedOrdersWithMedia, messagesWithImages] =
        await Promise.all([
          tx.order.findMany({
            where: { userId, status: { not: OrderStatus.DELIVERED } },
            select: { refundProofUrl: true, deliveryProofUrl: true },
          }),
          tx.message.findMany({
            where: { senderId: userId, imageUrl: { not: null } },
            select: { imageUrl: true },
          }),
        ]);
      await tx.order.updateMany({
        where: { userId, status: OrderStatus.DELIVERED },
        data: { userId: null },
      });
      await tx.order.updateMany({
        where: { userId, status: { not: OrderStatus.DELIVERED } },
        data: {
          userId: null,
          customerNameSnapshot: null,
          customerEmailSnapshot: null,
          customerPhoneSnapshot: null,
          shippingAddress: 'Thông tin người nhận đã được ẩn',
          districtId: null,
          wardCode: null,
          refundBankCode: null,
          refundAccountNumber: null,
          refundAccountName: null,
          refundReason: null,
          refundProofUrl: null,
          deliveryProofUrl: null,
          shippingNote: null,
        },
      });
      await tx.spaBooking.updateMany({
        where: { userId },
        data: { userId: null },
      });
      await tx.message.updateMany({
        where: { senderId: userId },
        data: { imageUrl: null },
      });
      await tx.match.updateMany({
        where: { endedById: userId },
        data: { endedById: null },
      });
      await tx.complaint.updateMany({
        where: { reporterId: userId },
        data: { reporterId: null },
      });
      await tx.complaint.updateMany({
        where: { targetId: userId, targetType: 'USER' },
        data: { targetId: null },
      });

      const pets = await this.petsService.deleteOwnedPetsInTransaction(
        tx,
        userId,
        petIds,
        'USER_DELETED',
      );
      await tx.matchingRequest.deleteMany({ where: { requesterId: userId } });
      await tx.user.delete({ where: { id: userId } });

      return {
        cancelledSpaBookings: spa.cancelledSpaBookings,
        cancelledMatchingRequests: pets.cancelledMatchingRequests,
        endedMatches: pets.endedMatches,
        mediaUrls: [
          user.avatarUrl,
          ...spa.mediaUrls,
          ...pets.mediaUrls,
          ...nonCompletedOrdersWithMedia.flatMap((order) => [
            order.refundProofUrl,
            order.deliveryProofUrl,
          ]),
          ...messagesWithImages.map((message) => message.imageUrl),
        ].filter((url): url is string => Boolean(url)),
      };
    });

    await Promise.all(
      [...new Set(result.mediaUrls)].map((url) =>
        this.cloudinary.destroyByUrl(url),
      ),
    );
    return {
      success: true,
      message: 'Tài khoản đã được xóa.',
      cancelledSpaBookings: result.cancelledSpaBookings,
      cancelledMatchingRequests: result.cancelledMatchingRequests,
      endedMatches: result.endedMatches,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Khong tim thay tai khoan.');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Tài khoản chưa có mật khẩu. Vui lòng tạo mật khẩu trước.',
      );
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng.');
    }

    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'Mật khẩu mới phải khác mật khẩu hiện tại.',
      );
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

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
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

  async getOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        payment: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return orders;
  }

  async createOrder(userId: string, dto: CreateOrderDto) {

    const payosItems: { name: string; quantity: number; price: number }[] = [];
    const paymentMethod = dto.paymentMethod === 'QR' ? 'QR' : 'COD';
    const orderCode =
      paymentMethod === 'QR'
        ? await this.paymentService.generateOrderCode()
        : null;

    const order = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, phone: true },
      });
      if (!customer) {
        throw new NotFoundException('Không tìm thấy tài khoản.');
      }

      // 1. Check stock for each item and decrement
      for (const item of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(
            `Sản phẩm với mã ${item.productId} không tồn tại.`,
          );
        }

        if (!product.isActive) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" hiện không mở bán.`,
          );
        }

        let itemName = product.name;

        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
          });

          if (!variant) {
            throw new NotFoundException(
              `Biến thể với mã ${item.variantId} không tồn tại.`,
            );
          }

          if (!variant.isActive) {
            throw new BadRequestException(
              `Biến thể "${variant.name}" của sản phẩm "${product.name}" hiện không hoạt động.`,
            );
          }

          if (variant.stock < item.quantity) {
            throw new BadRequestException(
              `Biến thể "${variant.name}" chỉ còn ${variant.stock} cái trong kho, không đủ đáp ứng số lượng đặt mua (${item.quantity} cái).`,
            );
          }

          // Decrement variant stock
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });
          await this.syncProductStockTx(tx, item.productId);

          itemName = `${product.name} (${variant.name})`;
        } else {
          // Fallback to product stock checking
          if (
            product.stock !== null &&
            product.stock !== undefined &&
            product.stock < item.quantity
          ) {
            throw new BadRequestException(
              `Sản phẩm "${product.name}" chỉ còn ${product.stock} cái trong kho, không đủ đáp ứng số lượng đặt mua (${item.quantity} cái).`,
            );
          }

          if (product.stock !== null && product.stock !== undefined) {
            // Decrement product stock
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            });
          }
        }

        // Store name for PayOS (strip special characters and accents, limit length)
        payosItems.push({
          name: cleanItemNameForPayOS(itemName),
          quantity: item.quantity,
          price: Math.round(item.price),
        });
      }

      // 4. Validate and apply Voucher
      let discountAmount = 0;
      let appliedVoucherCode: string | null = null;

      if (dto.voucherCode) {
        const codeUpper = dto.voucherCode.trim().toUpperCase();
        const voucher = await tx.voucher.findUnique({
          where: { code: codeUpper },
        });

        if (!voucher) {
          throw new BadRequestException('Mã giảm giá không tồn tại.');
        }

        if (!voucher.isActive) {
          throw new BadRequestException('Mã giảm giá đã bị vô hiệu hóa.');
        }

        if (voucher.expiredAt && voucher.expiredAt < new Date()) {
          throw new BadRequestException('Mã giảm giá đã hết hạn sử dụng.');
        }

        if (voucher.maxUsage && voucher.usedCount >= voucher.maxUsage) {
          throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng.');
        }

        if (voucher.type === 'FREE_SHIP') {
          discountAmount = dto.shippingFee || 0;
        }

        appliedVoucherCode = voucher.code;

        // Increment used count for the voucher
        await tx.voucher.update({
          where: { id: voucher.id },
          data: {
            usedCount: {
              increment: 1,
            },
          },
        });
      }

      // 5. Create the order
      const now = new Date();
      const year = String(now.getFullYear()).slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const date = String(now.getDate()).padStart(2, '0');
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randomChars = '';
      for (let i = 0; i < 4; i++) {
        randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const generatedId = `PM-${year}${month}${date}-${randomChars}`;
      const store = await tx.store.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!store) {
        throw new NotFoundException('Cửa hàng chưa được cấu hình.');
      }

      return tx.order.create({
        data: {
          id: generatedId,
          userId,
          customerNameSnapshot: customer.name,
          customerEmailSnapshot: customer.email,
          customerPhoneSnapshot: customer.phone,
          storeId: store.id,
          totalAmount: Math.max(0, dto.totalAmount - discountAmount),
          shippingFee: dto.shippingFee || 0,
          discountAmount,
          voucherCode: appliedVoucherCode,
          shippingAddress: dto.shippingAddress,
          districtId: dto.districtId,
          wardCode: dto.wardCode,
          status: 'PENDING',
          payment: {
            create: {
              sourceType: 'STORE_ORDER',
              method: paymentMethod,
              amount: Math.max(0, dto.totalAmount - discountAmount),
              orderCode,
            },
          },
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: {
          payment: true,
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    // 5. Integrate PayOS if QR selected
    if (paymentMethod === 'QR' && order.payment) {
      try {
        const paymentLink = await this.paymentService.createQrLink({
          paymentId: order.payment.id,
          descriptionPrefix: 'PM',
          returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders?status=success`,
          cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout?status=cancel&orderId=${order.id}`,
          items: payosItems,
        });

        const qrImageUrl = `https://img.vietqr.io/image/${paymentLink.bin}-${paymentLink.accountNumber}-compact2.png?amount=${paymentLink.amount}&addInfo=${encodeURIComponent(paymentLink.description)}&accountName=${encodeURIComponent(paymentLink.accountName)}`;

        return {
          ...order,
          checkoutUrl: paymentLink.checkoutUrl,
          qrData: {
            orderCode: paymentLink.orderCode,
            accountNumber: paymentLink.accountNumber,
            accountName: paymentLink.accountName,
            bin: paymentLink.bin,
            amount: paymentLink.amount,
            description: paymentLink.description,
            qrCode: paymentLink.qrCode,
            qrImageUrl,
          },
        };
      } catch (error) {
        console.error(
          'PayOS integration failed, setting order status to PAYMENT_ERROR:',
          error,
        );
        // Không xóa order và không hoàn stock. Cập nhật trạng thái thành PAYMENT_ERROR.
        const updatedOrder = await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'PAYMENT_ERROR' },
          include: {
            payment: true,
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
        });
        return {
          ...updatedOrder,
          checkoutUrl: null,
          qrData: null,
        };
      }
    }

    return order;
  }

  async cancelOrder(userId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { items: true, payment: true },
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng.');
      }
      if (order.status !== 'PENDING') {
        throw new BadRequestException(
          'Chỉ có thể hủy đơn hàng ở trạng thái chờ xác nhận.',
        );
      }

      // Restore stock
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
          await this.syncProductStockTx(tx, item.productId);
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      // Restore voucher usedCount if order used a voucher
      if (order.voucherCode) {
        const voucher = await tx.voucher.findUnique({
          where: { code: order.voucherCode },
        });
        if (voucher && voucher.usedCount > 0) {
          await tx.voucher.update({
            where: { id: voucher.id },
            data: {
              usedCount: {
                decrement: 1,
              },
            },
          });
        }
      }

      // Đơn hàng QR hay COD đều chuyển sang CANCELLED thay vì delete
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: 'CANCELLED' },
        });
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });
      await this.notifications.create({
        userId,
        category: NotificationCategory.ORDER,
        eventType: NotificationEventType.ORDER_STATUS_CHANGED,
        title: 'Đơn hàng đã hủy',
        content: `Đơn hàng #${order.id.slice(-8).toUpperCase()} đã được hủy.`,
        targetUrl: `/orders?orderId=${order.id}`,
        entityType: 'ORDER',
        entityId: order.id,
      }, tx);
      return updated;
    });
  }

  async deleteOrder(userId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng.');
      }
      if (order.status !== 'PENDING') {
        throw new BadRequestException(
          'Chỉ có thể xóa đơn hàng ở trạng thái chờ thanh toán/xác nhận.',
        );
      }

      // Restore stock
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
          await this.syncProductStockTx(tx, item.productId);
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      // Restore voucher usedCount if order used a voucher
      if (order.voucherCode) {
        const voucher = await tx.voucher.findUnique({
          where: { code: order.voucherCode },
        });
        if (voucher && voucher.usedCount > 0) {
          await tx.voucher.update({
            where: { id: voucher.id },
            data: {
              usedCount: {
                decrement: 1,
              },
            },
          });
        }
      }

      // Delete the order entirely
      return tx.order.delete({
        where: { id: orderId },
      });
    });
  }

  async updateOrderShipping(
    userId: string,
    orderId: string,
    data: { shippingAddress: string; districtId?: number; wardCode?: string },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }
    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        'Chỉ có thể thay đổi thông tin đơn hàng ở trạng thái chờ xác nhận.',
      );
    }

    let newShippingFee = 30000;

    const oldShippingFee = Number(order.shippingFee || 0);
    const newTotalAmount = Math.max(
      0,
      Number(order.totalAmount) - oldShippingFee + newShippingFee,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { orderId, status: { not: 'PAID' } },
        data: { amount: newTotalAmount },
      });
      return tx.order.update({
        where: { id: orderId },
        data: {
          shippingAddress: data.shippingAddress,
          districtId: data.districtId ? Number(data.districtId) : order.districtId,
          wardCode: data.wardCode ? String(data.wardCode) : order.wardCode,
          shippingFee: newShippingFee,
          totalAmount: newTotalAmount,
        },
        include: { payment: true },
      });
    });
  }

  async retryPayment(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        payment: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    if (
      order.status !== 'PENDING' &&
      order.status !== 'PAYMENT_ERROR' &&
      order.status !== 'EXPIRED'
    ) {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái có thể thanh toán.',
      );
    }

    if (order.payment?.method !== 'QR') {
      throw new BadRequestException(
        'Phương thức thanh toán của đơn hàng không phải là chuyển khoản QR.',
      );
    }

    // Sinh orderCode mới để tránh bị trùng lặp trên PayOS nếu orderCode cũ bị lỗi hoặc hết hạn
    const payosItems = order.items.map((item) => {
      const itemName = item.variant
        ? `${item.product.name} (${item.variant.name})`
        : item.product.name;
      return {
        name: cleanItemNameForPayOS(itemName),
        quantity: item.quantity,
        price: Math.round(item.price),
      };
    });

    try {
      const paymentLink = await this.paymentService.createQrLink({
        paymentId: order.payment.id,
        descriptionPrefix: 'PM',
        returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders?status=success`,
        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout?status=cancel&orderId=${order.id}`,
        items: payosItems,
        forceNewCode:
          order.payment.status === 'EXPIRED' ||
          order.payment.status === 'PAYMENT_ERROR',
      });

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PENDING',
        },
        include: {
          payment: true,
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const qrImageUrl = `https://img.vietqr.io/image/${paymentLink.bin}-${paymentLink.accountNumber}-compact2.png?amount=${paymentLink.amount}&addInfo=${encodeURIComponent(paymentLink.description)}&accountName=${encodeURIComponent(paymentLink.accountName)}`;

      return {
        ...updatedOrder,
        checkoutUrl: paymentLink.checkoutUrl,
        qrData: {
          orderCode: paymentLink.orderCode,
          accountNumber: paymentLink.accountNumber,
          accountName: paymentLink.accountName,
          bin: paymentLink.bin,
          amount: paymentLink.amount,
          description: paymentLink.description,
          qrCode: paymentLink.qrCode,
          qrImageUrl,
        },
      };
    } catch (error) {
      console.error('Failed to retry PayOS payment link creation:', error);
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAYMENT_ERROR' },
      });
      throw new BadRequestException(
        'Không thể tạo lại liên kết thanh toán PayOS. Vui lòng thử lại sau.',
      );
    }
  }

  async requestRefund(
    userId: string,
    orderId: string,
    data: {
      bankCode: string;
      accountNumber: string;
      accountName: string;
      reason: string;
    },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    if (order.status !== 'PROCESSING' && order.status !== 'CANCELLED') {
      throw new BadRequestException(
        'Chỉ có thể yêu cầu hoàn tiền cho đơn hàng đang xử lý hoặc đã hủy.',
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'PENDING',
        refundBankCode: data.bankCode,
        refundAccountNumber: data.accountNumber,
        refundAccountName: data.accountName,
        refundReason: data.reason,
      },
    });
  }
}

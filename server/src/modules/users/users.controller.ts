import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

type UploadedAvatar = {
  buffer: Buffer;
  mimetype: string;
};

type UploadFileMeta = {
  originalname: string;
  mimetype: string;
};

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.usersService.getProfileWithStats(req.user.id);
  }

  @Put('profile')
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Delete('profile')
  deleteAccount(@Req() req: AuthenticatedRequest) {
    return this.usersService.deleteAccount(req.user.id);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (
        _req: unknown,
        file: UploadFileMeta,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(
            new BadRequestException(
              'Chi cho phep file anh jpg, jpeg, png hoac webp.',
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: UploadedAvatar,
  ) {
    if (!file) {
      throw new BadRequestException('Khong tim thay file anh tai len.');
    }

    const image = await this.cloudinary.uploadBuffer(
      file.buffer,
      `petmatching/users/${req.user.id}/avatars`,
      {
        quality: 'auto:good',
        fetch_format: 'auto',
        transformation: [
          { width: 800, height: 800, crop: 'fill', gravity: 'auto' },
        ],
      },
    );
    await this.usersService.updateProfile(req.user.id, { avatarUrl: image.url });
    return { avatarUrl: image.url, publicId: image.publicId };
  }

  @Post('change-password')
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.id, dto);
  }

  @Get('addresses')
  getAddresses(@Req() req: AuthenticatedRequest) {
    return this.usersService.getAddresses(req.user.id);
  }

  @Post('addresses')
  createAddress(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.createAddress(req.user.id, dto);
  }

  @Put('addresses/:id')
  updateAddress(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(req.user.id, id, dto);
  }

  @Delete('addresses/:id')
  deleteAddress(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.usersService.deleteAddress(req.user.id, id);
  }

  @Patch('addresses/:id/default')
  setDefaultAddress(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.setDefaultAddress(req.user.id, id);
  }

  @Get('orders')
  getOrders(@Req() req: AuthenticatedRequest) {
    return this.usersService.getOrders(req.user.id);
  }

  @Post('orders')
  createOrder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateOrderDto,
  ) {
    return this.usersService.createOrder(req.user.id, dto);
  }

  @Patch('orders/:id/cancel')
  cancelOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.cancelOrder(req.user.id, id);
  }

  @Put('orders/:id/shipping')
  updateOrderShipping(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { shippingAddress: string },
  ) {
    return this.usersService.updateOrderShipping(req.user.id, id, body);
  }

  @Post('orders/:id/retry-payment')
  retryPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.retryPayment(req.user.id, id);
  }
}

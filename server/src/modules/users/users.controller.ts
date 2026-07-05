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
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

type UploadedAvatar = {
  filename: string;
};

type UploadFileMeta = {
  originalname: string;
  mimetype: string;
};

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
      storage: diskStorage({
        destination: (
          _req: unknown,
          _file: UploadFileMeta,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          const uploadPath = join(process.cwd(), 'uploads');
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (
          _req: unknown,
          file: UploadFileMeta,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
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
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadAvatar(@UploadedFile() file?: UploadedAvatar) {
    if (!file) {
      throw new BadRequestException('Khong tim thay file anh tai len.');
    }

    const baseUrl = process.env.API_PUBLIC_URL || 'http://localhost:5000';
    return { avatarUrl: `${baseUrl}/uploads/${file.filename}` };
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
}

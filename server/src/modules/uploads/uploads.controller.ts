import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { UploadImagesDto, UploadPurpose } from './dto/upload-images.dto';

type MemoryImage = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

@UseGuards(JwtAuthGuard)
@Controller('api/uploads')
export class UploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Post('images')
  @UseInterceptors(
    FilesInterceptor('files', 6, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 6 },
      fileFilter: (_request, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadImages(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UploadImagesDto,
    @UploadedFiles() files?: MemoryImage[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('Không tìm thấy ảnh để tải lên.');
    }

    const folder = this.folderFor(dto.purpose, request.user.id);
    const isDocument =
      dto.purpose === UploadPurpose.VACCINE_DOCUMENT ||
      dto.purpose === UploadPurpose.PEDIGREE_DOCUMENT;

    const images = await Promise.all(
      files.map((file) =>
        this.cloudinary.uploadBuffer(file.buffer, folder, {
          quality: 'auto:good',
          fetch_format: 'auto',
          transformation: isDocument
            ? [{ width: 2000, height: 2000, crop: 'limit' }]
            : [{ width: 1600, height: 1600, crop: 'limit' }],
        }),
      ),
    );

    return { images };
  }

  private folderFor(purpose: UploadPurpose, userId: string): string {
    const folderByPurpose: Record<UploadPurpose, string> = {
      [UploadPurpose.PET_AVATAR]: 'pets/avatar',
      [UploadPurpose.PET_GALLERY]: 'pets/gallery',
      [UploadPurpose.VACCINE_DOCUMENT]: 'pet-documents/vaccines',
      [UploadPurpose.PEDIGREE_DOCUMENT]: 'pet-documents/pedigrees',
      [UploadPurpose.PRODUCT]: 'products',
      [UploadPurpose.SPA_RESULT]: 'spa-results',
    };
    return `petmatching/users/${userId}/${folderByPurpose[purpose]}`;
  }
}

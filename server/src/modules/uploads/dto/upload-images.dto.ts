import { IsOptional, IsString } from 'class-validator';

export enum UploadPurpose {
  PET_AVATAR = 'pet-avatar',
  PET_GALLERY = 'pet-gallery',
  VACCINE_DOCUMENT = 'vaccine-document',
  PEDIGREE_DOCUMENT = 'pedigree-document',
  PRODUCT = 'product',
  SPA_RESULT = 'spa-result',
  REVIEW = 'review',
}

export class UploadImagesDto {
  @IsString()
  @IsOptional()
  purpose?: string;
}

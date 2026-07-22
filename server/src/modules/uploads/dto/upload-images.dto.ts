import { IsEnum } from 'class-validator';

export enum UploadPurpose {
  PET_AVATAR = 'pet-avatar',
  PET_GALLERY = 'pet-gallery',
  VACCINE_DOCUMENT = 'vaccine-document',
  PEDIGREE_DOCUMENT = 'pedigree-document',
  PRODUCT = 'product',
  SPA_RESULT = 'spa-result',
}

export class UploadImagesDto {
  @IsEnum(UploadPurpose)
  purpose!: UploadPurpose;
}


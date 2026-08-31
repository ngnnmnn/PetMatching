import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateStoreSettingsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressDetail: string;

  @IsString()
  @Matches(/^\d+$/)
  wardCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

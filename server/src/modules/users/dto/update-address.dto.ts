import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  receiverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  receiverPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ward?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  detail?: string;

  @IsOptional()
  @IsNumber()
  provinceId?: number;

  @IsOptional()
  @IsNumber()
  districtId?: number;

  @IsOptional()
  @IsString()
  wardCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

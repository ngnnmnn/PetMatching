import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MaxLength(80)
  receiverName: string;

  @IsString()
  @MaxLength(20)
  receiverPhone: string;

  @IsString()
  @MaxLength(80)
  province: string;

  @IsString()
  @MaxLength(80)
  district: string;

  @IsString()
  @MaxLength(80)
  ward: string;

  @IsString()
  @MaxLength(160)
  detail: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

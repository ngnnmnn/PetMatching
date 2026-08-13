import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  IsDateString,
} from 'class-validator';

export enum VoucherType {
  FREE_SHIP = 'FREE_SHIP',
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export class CreateVoucherDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã giảm giá không được để trống.' })
  code: string;

  @IsEnum(VoucherType, { message: 'Loại mã giảm giá không hợp lệ.' })
  type: VoucherType;

  @IsNumber({}, { message: 'Giá trị giảm phải là số.' })
  @Min(0, { message: 'Giá trị giảm không được nhỏ hơn 0.' })
  value: number;

  @IsOptional()
  @IsNumber({}, { message: 'Giá trị đơn tối thiểu phải là số.' })
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Mức giảm tối đa phải là số.' })
  @Min(0)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Số lần sử dụng tối đa phải từ 1 trở lên.' })
  maxUsage?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ.' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày hết hạn không hợp lệ.' })
  expiredAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVoucherDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(VoucherType)
  type?: VoucherType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsage?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  expiredAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

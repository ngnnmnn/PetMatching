import {
  IsArray,
  ArrayMinSize,
  IsInt,
  IsNumber,
  IsString,
  ValidateNested,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  /** Chỉ giữ để tương thích frontend cũ; backend không sử dụng giá này. */
  @IsNumber()
  @IsOptional()
  price?: number;
}

export class CreateOrderDto {
  /** Chỉ giữ để tương thích frontend cũ; backend tự tính lại tổng tiền. */
  @IsNumber()
  @IsOptional()
  totalAmount?: number;

  /** Chỉ giữ để tương thích frontend cũ; backend tự tính lại phí vận chuyển. */
  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @IsString()
  shippingAddress: string;

  @IsNumber()
  @IsOptional()
  districtId?: number;

  @IsString()
  @IsOptional()
  wardCode?: string;

  @IsNumber()
  @IsOptional()
  shippingLatitude?: number;

  @IsNumber()
  @IsOptional()
  shippingLongitude?: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  voucherCode?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

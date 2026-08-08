import {
  IsArray,
  IsNumber,
  IsString,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price: number;
}

export class CreateOrderDto {
  @IsNumber()
  totalAmount: number;

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

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  voucherCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

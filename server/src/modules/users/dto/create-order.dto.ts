import { IsArray, IsNumber, IsString, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class CreateOrderItemDto {
  @IsString()
  productId: string;

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

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  voucherCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

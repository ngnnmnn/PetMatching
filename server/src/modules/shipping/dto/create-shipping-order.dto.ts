import { IsString } from 'class-validator';

export class CreateShippingOrderDto {
  @IsString()
  orderId: string;
}

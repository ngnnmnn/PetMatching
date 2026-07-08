import { IsNotEmpty, IsString } from 'class-validator';

export class ToggleWishlistDto {
  @IsNotEmpty()
  @IsString()
  productId: string;
}

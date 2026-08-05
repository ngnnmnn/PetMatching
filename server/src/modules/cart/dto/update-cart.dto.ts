import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCartDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  variantId?: string;
}

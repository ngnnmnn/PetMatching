import { IsArray, IsString } from 'class-validator';

export class MergeWishlistDto {
  @IsArray()
  @IsString({ each: true })
  productIds: string[];
}

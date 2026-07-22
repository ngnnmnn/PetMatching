import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CalculateFeeDto {
  @IsNumber()
  toDistrictId: number;

  @IsString()
  toWardCode: string;

  @IsNumber()
  @IsOptional()
  weight?: number; // tính bằng gram (VD: 500 = 0.5kg)

  @IsNumber()
  @IsOptional()
  length?: number; // cm

  @IsNumber()
  @IsOptional()
  width?: number; // cm

  @IsNumber()
  @IsOptional()
  height?: number; // cm

  @IsNumber()
  @IsOptional()
  insuranceValue?: number; // Giá trị khai giá bảo hiểm
}

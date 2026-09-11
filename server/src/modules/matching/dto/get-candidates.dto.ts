import {
  IsBooleanString,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class GetCandidatesDto {
  @IsString()
  femalePetId!: string;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumberString()
  weightMin?: string;

  @IsOptional()
  @IsNumberString()
  weightMax?: string;

  @IsOptional()
  @IsBooleanString()
  verifiedOnly?: string;

  /// Lọc chỉ hiển thị thú cưng có giấy phả hệ (hỗ trợ cả hasPedigreeOnly và purebredOnly)
  @IsOptional()
  @IsBooleanString()
  hasPedigreeOnly?: string;

  @IsOptional()
  @IsBooleanString()
  purebredOnly?: string;

  /// Lọc chỉ hiển thị thú cưng đã tiêm chủng
  @IsOptional()
  @IsBooleanString()
  vaccinatedOnly?: string;

  @IsOptional()
  @IsNumberString()
  maxDistanceKm?: string;
}

import { IsBooleanString, IsNumberString, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  @IsBooleanString()
  hasPedigreeOnly?: string;

  @IsOptional()
  @IsNumberString()
  maxDistanceKm?: string;
}

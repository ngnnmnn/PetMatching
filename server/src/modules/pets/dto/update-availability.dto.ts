import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BreedingOption, PetStatus } from '@prisma/client';

export class UpdateAvailabilityDto {
  @IsBoolean()
  isAvailableForMatching!: boolean;

  @IsOptional()
  @IsEnum(BreedingOption)
  breedingOption?: BreedingOption;

  @IsOptional()
  @IsNumber()
  @Min(0)
  breedingFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  shareLitterCount?: number;

  @IsOptional()
  @IsEnum(PetStatus)
  status?: PetStatus;

  @IsOptional()
  @IsString()
  personality?: string;

}

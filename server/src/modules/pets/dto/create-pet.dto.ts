import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { BreedingOption, Gender, Species } from '@prisma/client';

export class CreatePetDto {
  @IsString()
  name!: string;

  @IsEnum(Species)
  species!: Species;

  @IsString()
  breed!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsString()
  birthday!: string;

  @IsNumber()
  weight!: number;

  @IsString()
  location!: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  gallery?: string[];

  @IsOptional()
  @IsString()
  personality?: string;

  @IsOptional()
  @IsBoolean()
  isVaccinated?: boolean;

  @IsOptional()
  @IsBoolean()
  hasPedigree?: boolean;

  @IsOptional()
  @IsString()
  pedigreeNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  vaccineDocumentUrls?: string[];

  @IsOptional()
  @IsString()
  vaccineNote?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  pedigreeDocumentUrls?: string[];

  @IsOptional()
  @IsString()
  pedigreeNote?: string;

  @IsOptional()
  @IsEnum(BreedingOption)
  breedingOption?: BreedingOption;

  @IsOptional()
  @IsNumber()
  breedingFee?: number;
}

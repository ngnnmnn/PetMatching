import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { BreedingOption, Gender, PetStatus, Species } from '@prisma/client';

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
  avatarUrl?: string;

  @IsOptional()
  @IsString({ each: true })
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
  vaccineDocumentUrls?: string[];

  @IsOptional()
  @IsString()
  vaccineNote?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
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

  @IsOptional()
  @IsEnum(PetStatus)
  status?: PetStatus;
}

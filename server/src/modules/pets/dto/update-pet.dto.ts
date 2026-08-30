import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PET_WEIGHT_LIMITS } from '../../../common/constants/pet-weight.constants';

export class UpdatePetDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(PET_WEIGHT_LIMITS.DOG.profileMin)
  @Max(PET_WEIGHT_LIMITS.DOG.profileMax)
  weight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsUrl({ require_tld: false }, { each: true })
  @MaxLength(2048, { each: true })
  gallery?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  personality?: string | null;

  @IsOptional()
  @IsBoolean()
  isVaccinated?: boolean;

  @IsOptional()
  @IsBoolean()
  hasPedigree?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pedigreeNumber?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsUrl({ require_tld: false }, { each: true })
  @MaxLength(2048, { each: true })
  vaccineDocumentUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsUrl({ require_tld: false }, { each: true })
  @MaxLength(2048, { each: true })
  pedigreeDocumentUrls?: string[];
}

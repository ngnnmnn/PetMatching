import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Species } from '@prisma/client';

export class CreateBookingDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  addressSpaId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  mainServiceId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subServiceIds?: string[];

  @IsOptional()
  @IsString()
  petName?: string;

  @IsOptional()
  @IsEnum(Species)
  petSpecies?: Species;

  @IsOptional()
  @IsNumber()
  petWeight?: number;

  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  petId?: string;
}

export class AddSubServicesDto {
  @IsArray()
  @IsString({ each: true })
  subServiceIds: string[];
}

export class ManagerReassignDto {
  @IsNotEmpty()
  @IsString()
  staffId: string;
}

export class ManagerRescheduleDto {
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;
}

export class ManagerUpdateServicesDto {
  @IsNotEmpty()
  @IsString()
  mainServiceId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subServiceIds?: string[];
}

export class CreateStaffDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  fullname: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class CreateSpaFeedbackDto {
  @IsNumber()
  rateStaff: number;

  @IsNumber()
  rateServices: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

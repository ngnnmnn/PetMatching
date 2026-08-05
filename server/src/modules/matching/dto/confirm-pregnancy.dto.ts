import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmPregnancyDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsDateString()
  expectedDueDate?: string;
}

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMatchingRequestDto {
  @IsString()
  femalePetId!: string;

  @IsString()
  malePetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

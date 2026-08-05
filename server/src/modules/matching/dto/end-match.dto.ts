import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EndMatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

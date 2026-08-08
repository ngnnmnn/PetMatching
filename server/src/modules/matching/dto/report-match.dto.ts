import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const MATCH_REPORT_REASONS = [
  'INAPPROPRIATE_MESSAGE',
  'HARASSMENT',
  'FAKE_INFORMATION',
  'PET_SAFETY',
  'NO_SHOW',
  'OTHER',
] as const;

export class ReportMatchDto {
  @IsIn(MATCH_REPORT_REASONS)
  reason!: (typeof MATCH_REPORT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;
}

import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const MATCH_REPORT_REASONS = [
  'INAPPROPRIATE_MESSAGE',
  'HARASSMENT',
  'FAKE_INFORMATION',
  'PET_SAFETY',
  'NO_SHOW',
  'OTHER',
] as const;

export const MATCH_REPORT_TARGETS = ['USER', 'PET'] as const;

export const MATCH_REPORT_REASONS_BY_TARGET = {
  USER: [
    'INAPPROPRIATE_MESSAGE',
    'HARASSMENT',
    'FAKE_INFORMATION',
    'NO_SHOW',
    'OTHER',
  ],
  PET: ['FAKE_INFORMATION', 'PET_SAFETY', 'OTHER'],
} as const;

export class ReportMatchDto {
  @IsIn(MATCH_REPORT_TARGETS)
  targetType!: (typeof MATCH_REPORT_TARGETS)[number];

  @IsIn(MATCH_REPORT_REASONS)
  reason!: (typeof MATCH_REPORT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;
}

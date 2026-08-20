import {
  AccountStatus,
  ApprovalStatus,
  ComplaintAction,
  ComplaintStatus,
  DocumentStatus,
  Species,
  UserRole,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateAccountStatusDto {
  @IsIn([AccountStatus.ACTIVE, AccountStatus.SUSPENDED])
  accountStatus!: AccountStatus;
}

export class GrantSpaManagerDto {
  @IsOptional()
  @IsBoolean()
  allowReassignment?: boolean;
}

export class RevokeSpaManagerDto {
  @IsIn(['UNASSIGN', 'TRANSFER'])
  mode!: 'UNASSIGN' | 'TRANSFER';

  @ValidateIf((dto: RevokeSpaManagerDto) => dto.mode === 'TRANSFER')
  @IsString()
  newManagerId?: string;
}

export const hidePetReasons = [
  'CONTENT_VIOLATION',
  'INACCURATE_INFORMATION',
  'SUSPECTED_FAKE',
  'DOCUMENT_FRAUD',
  'UNRESOLVED_REPORT',
  'OTHER',
] as const;

export const restorePetReasons = [
  'INFORMATION_VERIFIED',
  'REPORT_RESOLVED',
  'DOCUMENTS_APPROVED',
  'ADMIN_REVIEW',
  'OTHER',
] as const;

export class HidePetDto {
  @IsIn(hidePetReasons)
  reason!: (typeof hidePetReasons)[number];

  @IsOptional()
  @IsString()
  note?: string;
}

export class RestorePetDto {
  @IsIn(restorePetReasons)
  reason!: (typeof restorePetReasons)[number];

  @IsOptional()
  @IsString()
  note?: string;
}

export class ReviewPetDocumentDto {
  @IsEnum(DocumentStatus)
  status!: DocumentStatus;

  @ValidateIf((dto: ReviewPetDocumentDto) =>
    dto.reviewNote !== undefined ||
    dto.status === DocumentStatus.REJECTED ||
    dto.status === DocumentStatus.NEED_MORE_INFO,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reviewNote?: string;
}

export class UpdateApprovalStatusDto {
  @IsEnum(ApprovalStatus)
  status!: ApprovalStatus;
}

export class ResolveComplaintDto {
  @IsEnum(ComplaintAction)
  action!: ComplaintAction;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

const matchingReportResolutionStatuses = [
  ComplaintStatus.RESOLVED,
  ComplaintStatus.DISMISSED,
  ComplaintStatus.INSUFFICIENT_EVIDENCE,
] as const;

export class ResolveMatchingReportDto {
  @IsIn(matchingReportResolutionStatuses)
  status!: (typeof matchingReportResolutionStatuses)[number];

  @IsEnum(ComplaintAction)
  action!: ComplaintAction;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  adminNote!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  resolutionMessage!: string;
}

const reportAbuseModerationActions = ['WARNING', 'BLOCK'] as const;

export class ModerateReportAbuseDto {
  @IsIn(reportAbuseModerationActions)
  action!: (typeof reportAbuseModerationActions)[number];
}

export class CreateBreedRuleDto {
  @IsEnum(Species)
  species!: Species;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  breedA!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  breedB!: string;

  @IsBoolean()
  isCompatible!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  offspringName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  warningNote?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBreedRuleDto extends CreateBreedRuleDto {}

export class CreateBreedDto {
  @IsEnum(Species)
  species!: Species;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBreedDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

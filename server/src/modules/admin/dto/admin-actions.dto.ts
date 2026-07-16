import {
  AccountStatus,
  ApprovalStatus,
  ComplaintAction,
  ComplaintStatus,
  ComplaintType,
  DocumentStatus,
  UserRole,
} from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsJSON,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateAccountStatusDto {
  @IsEnum(AccountStatus)
  accountStatus!: AccountStatus;
}

export class GrantSpaManagerDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  branchIds!: string[];

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

  @IsOptional()
  @IsString()
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

export class CreateComplaintDto {
  @IsEnum(ComplaintType)
  type!: ComplaintType;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsString()
  reporterId?: string;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  targetId?: string;
}

export class UpsertSettingDto {
  @IsString()
  key!: string;

  @IsJSON()
  value!: string;
}

export type ComplaintResolution = {
  status: ComplaintStatus;
  actionTaken: ComplaintAction;
  adminNote?: string;
};

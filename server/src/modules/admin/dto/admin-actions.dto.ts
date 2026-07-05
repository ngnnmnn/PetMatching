import {
  AccountStatus,
  ApprovalStatus,
  ComplaintAction,
  ComplaintStatus,
  ComplaintType,
  DocumentStatus,
  UserRole,
} from '@prisma/client';
import { IsEnum, IsJSON, IsOptional, IsString } from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateAccountStatusDto {
  @IsEnum(AccountStatus)
  accountStatus!: AccountStatus;
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

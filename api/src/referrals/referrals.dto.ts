import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
  IsObject,
} from 'class-validator';

export const PHOTO_VIEWS = [
  'UNASSIGNED',
  'EXTRAORAL_FRONT',
  'EXTRAORAL_SMILE',
  'EXTRAORAL_PROFILE',
  'INTRAORAL_FRONT',
  'INTRAORAL_RIGHT',
  'INTRAORAL_LEFT',
  'OCCLUSAL_UPPER',
  'OCCLUSAL_LOWER',
] as const;

export class TreatmentRequestDto {
  @IsOptional() @IsString() @MaxLength(2000) goals?: string;
  @IsOptional() @IsString() @MaxLength(1000) upperMidline?: string;
  @IsOptional() @IsString() @MaxLength(1000) lowerMidline?: string;
  @IsOptional() @IsString() @MaxLength(2000) attachments?: string;
  @IsOptional() @IsString() @MaxLength(2000) elasticCuts?: string;
  @IsOptional() @IsString() @MaxLength(2000) buttons?: string;
  @IsOptional() @IsString() @MaxLength(2000) ipr?: string;
  @IsOptional() @IsString() @MaxLength(2000) restrictions?: string;
}

export class CreateColleagueDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}
export class ColleagueAccessDto {
  @IsBoolean() enabled: boolean;
}
export class ReferralInputDto {
  @IsString() @MinLength(2) @MaxLength(160) fullName: string;
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.replace(/[.\s-]/g, '').toUpperCase()
      : value,
  )
  @IsString()
  @MinLength(8)
  @MaxLength(12)
  rut: string;
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
  @IsString() @MinLength(6) @MaxLength(30) phone: string;
  @IsString() @MinLength(5) @MaxLength(5000) reason: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TreatmentRequestDto)
  treatment?: TreatmentRequestDto;
}
export class CommentDto {
  @IsString() @MinLength(1) @MaxLength(5000) content: string;
}
export class SetupDto {
  @IsString() @MinLength(2) @MaxLength(160) title: string;
  @IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true })
  @MaxLength(2048)
  url: string;
}
export class SetupDecisionDto {
  @IsIn(['APPROVED', 'CHANGES_REQUESTED']) decision: string;
  @IsOptional() @IsString() @MaxLength(5000) note?: string;
}
export class ReferralStageDto {
  @IsIn(['PLANNING', 'MANUFACTURING', 'DELIVERED']) stage: string;
  @IsString() @MaxLength(30) expectedStage: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
export class AcceptReferralDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) patientId?: string;
}
export class SharePatientDto {
  @IsString() @MinLength(1) @MaxLength(100) patientId: string;
  @IsString() @MinLength(1) @MaxLength(100) referrerId: string;
  @IsString() @MinLength(5) @MaxLength(5000) reason: string;
}
export class UploadReferralFileDto {
  @IsIn(['STL_UPPER', 'STL_LOWER', 'PHOTO', 'XRAY']) kind: string;
  @IsOptional() @IsIn(PHOTO_VIEWS) photoView?: string;
}
export class PhotoViewDto {
  @IsIn(PHOTO_VIEWS) photoView: string;
}
export class CropUploadDto {
  @IsString() @MaxLength(2000) recipe: string;
  @IsIn(PHOTO_VIEWS) photoView: string;
}
export class CropProposalDto {
  @IsIn(['true']) consent: string;
}

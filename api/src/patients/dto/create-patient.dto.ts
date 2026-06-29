import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePatientDto {
  @IsNotEmpty()
  @IsString()
  rut: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  treatmentStartDate: string; // "YYYY-MM-DD"; converted to a Date in the service

  @Type(() => Number)
  @IsInt()
  changeFrequency: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalAligners?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentAligner?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  wearDaysPerAligner?: number;

  @IsOptional()
  @IsString()
  batchStartDate?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clinic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  doctor?: string;
}

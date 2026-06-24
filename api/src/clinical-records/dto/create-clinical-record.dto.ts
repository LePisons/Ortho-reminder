import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClinicalRecordDto {
  @IsOptional()
  @IsString()
  date?: string; // Optional, defaults to now in the service

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsNotEmpty()
  @IsString()
  patientId: string;
}

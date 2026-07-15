import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateModelSetDto {
  @IsString()
  patientId: string;

  @IsOptional()
  @IsDateString()
  takenAt?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

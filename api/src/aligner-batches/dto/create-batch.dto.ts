import { IsInt, IsOptional, IsString, IsEmail, Min } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  patientId: string;

  @IsInt()
  @Min(1)
  alignerCount: number;

  @IsOptional()
  @IsString()
  @IsEmail()
  technicianEmail?: string;

  @IsOptional()
  @IsString()
  technicianNotes?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class CreateReevaluationDto {
  @IsString()
  patientId: string;
  
  @IsOptional()
  @IsString()
  notes?: string;
}

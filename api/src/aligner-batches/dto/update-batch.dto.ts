import { IsOptional, IsString } from 'class-validator';

export class UpdateBatchDto {
  @IsOptional()
  @IsString()
  notes?: string;
  
  @IsOptional()
  @IsString()
  technicianNotes?: string;
}

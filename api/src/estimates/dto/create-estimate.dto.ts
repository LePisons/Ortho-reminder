import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Arrives as multipart form fields alongside the PDF file; `data` is the full
// builder snapshot serialized as a JSON string (parsed in the controller).
export class CreateEstimateDto {
  @IsNotEmpty()
  @IsString()
  patientName: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalClp?: number;

  @IsNotEmpty()
  @IsString()
  data: string;
}

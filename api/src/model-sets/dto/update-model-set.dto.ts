import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateModelSetDto {
  @IsOptional()
  @IsDateString()
  takenAt?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

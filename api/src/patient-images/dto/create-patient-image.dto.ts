import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ImageType } from '@prisma/client';

export class CreatePatientImageDto {
  @IsNotEmpty()
  @IsString()
  url: string; // set server-side after upload

  @IsEnum(ImageType)
  type: ImageType;

  @IsOptional()
  @IsString()
  date?: string; // Optional, defaults to now

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsNotEmpty()
  @IsString()
  patientId: string;
}

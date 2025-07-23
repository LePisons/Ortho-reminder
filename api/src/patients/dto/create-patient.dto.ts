import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsDateString,
  IsInt,
  IsPositive,
  IsOptional, // <-- Import IsOptional
} from 'class-validator';

export class CreatePatientDto {
  // We'll add this new optional property. It's for the public registration form.
  @IsString()
  @IsOptional()
  orthoId?: string;

  // Keep all the existing properties as they were
  @IsString()
  @IsNotEmpty()
  rut: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  email: string;

  @IsDateString()
  treatmentStartDate: string;

  @IsInt()
  @IsPositive()
  changeFrequency: number;
}

import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class LinkDentalinkPatientDto {
  @IsNotEmpty()
  @IsString()
  patientId: string;

  @IsInt()
  @IsPositive()
  dentalinkId: number;

  /** Clinic key the Dentalink ID belongs to (defaults to the primary clinic). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  clinic?: string;
}

import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class AddDentalinkPatientDto {
  /** Dentalink patient ID. */
  @IsInt()
  @IsPositive()
  id: number;

  /**
   * Optional display name. When omitted the name is resolved automatically from
   * Dentalink using the patient ID.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  /** Clinic key the patient belongs to (defaults to the primary clinic). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  clinic?: string;
}

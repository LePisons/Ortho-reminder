import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class LinkDentalinkPatientDto {
  @IsNotEmpty()
  @IsString()
  patientId: string;

  @IsInt()
  @IsPositive()
  dentalinkId: number;
}

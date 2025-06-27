export class CreatePatientDto {
  rut: string;
  fullName: string;
  phone: string;
  email: string;
  treatmentStartDate: string; // Use string for now, we'll convert it
  changeFrequency: number;
}

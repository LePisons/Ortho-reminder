export class CreatePatientDto {
  rut: string;
  fullName: string;
  phone: string;
  email: string;
  treatmentStartDate: string; // Use string for now, we'll convert it
  changeFrequency: number;
  totalAligners?: number;
  currentAligner?: number;
  wearDaysPerAligner?: number;
  batchStartDate?: string;
  avatarUrl?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  observations?: string;
}

export class CreateClinicalRecordDto {
  date?: string; // Optional, default to now
  diagnosis?: string;
  treatmentPlan?: string;
  observations?: string;
  patientId: string;
}

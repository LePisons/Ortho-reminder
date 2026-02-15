import { ImageType } from '@prisma/client';

export class CreatePatientImageDto {
  url: string;
  type: ImageType;
  date?: string; // Optional, default to now
  description?: string;
  patientId: string;
}

export interface Patient {
  id: string;
  rut: string;
  fullName: string;
  phone: string;
  email: string;
  treatmentStartDate: string;
  changeFrequency: number;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  avatarUrl?: string; // Optional field for profile picture
  createdAt: string;
  updatedAt: string;
  clinicalRecords?: ClinicalRecord[];
  patientImages?: PatientImage[];
}

export interface ClinicalRecord {
  id: string;
  date: string;
  diagnosis?: string;
  treatmentPlan?: string;
  observations?: string;
  patientId: string;
}

export interface PatientImage {
  id: string;
  url: string;
  type: 'PHOTO' | 'XRAY';
  date: string;
  description?: string;
  patientId: string;
}

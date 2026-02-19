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
  diagnosis?: string;
  treatmentPlan?: string;
  observations?: string;
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
  category?: string;
  patientId: string;
}


export interface Note {
  id: string;
  content: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  patientId: string;
}


export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface Appointment {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  status: AppointmentStatus;
  description?: string;
  patientId?: string;
  patient?: {
    id: string;
    fullName: string;
  };
}

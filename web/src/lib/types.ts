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
  totalAligners?: number;
  currentAligner?: number;
  wearDaysPerAligner?: number;
  batchStartDate?: string;
  trackingStartedAt?: string | null;
  urgencyStatus?: 'ON_TRACK' | 'ENDING_SOON' | 'OVERDUE' | 'AWAITING_REEVALUATION';
  observations?: string;
  createdAt: string;
  updatedAt: string;
  clinicalRecords?: ClinicalRecord[];
  patientImages?: PatientImage[];
  pipelineStage?: 'REQUIRED_FILES' | 'IN_PRODUCTION' | 'READY_FOR_PICKUP' | 'IN_TREATMENT' | 'REEVALUATION' | 'ENDING_SOON' | null;
  alignerBatches?: AlignerBatch[];
  reevaluations?: Reevaluation[];
  whatsappOptedIn?: boolean;
  whatsappOptedInAt?: string | null;
  onboardingToken?: {
    token: string;
    expiresAt: string;
    usedAt: string | null;
  } | null;
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

export type BatchStatus = 
  | 'NEEDED'
  | 'ORDER_SENT'
  | 'IN_PRODUCTION'
  | 'DELIVERED_TO_CLINIC'
  | 'HANDED_TO_PATIENT'
  | 'CANCELLED';

export interface BatchEvent {
  id: string;
  batchId: string;
  fromStatus?: BatchStatus;
  toStatus: BatchStatus;
  note?: string;
  createdBy?: string;
  createdAt: string;
}

export interface AlignerBatch {
  id: string;
  status: BatchStatus;
  orderDate?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  notes?: string;
  batchNumber: number;
  alignerCount: number;
  gooFileUrl?: string | null;
  technicianEmail?: string;
  technicianNotes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  patientId: string;
  batchEvents?: BatchEvent[];
}

export type ReevaluationStatus = 'NEEDED' | 'SCAN_UPLOADED' | 'APPROVED';

export interface Reevaluation {
  id: string;
  status: ReevaluationStatus;
  scanDate?: string;
  scanFileUrl?: string;
  approvalDate?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  patientId: string;
}


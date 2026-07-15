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
  lastAlignerSetAt?: string | null;
  lastAppointmentDate?: string | null;
  urgencyStatus?: 'ON_TRACK' | 'ENDING_SOON' | 'OVERDUE' | 'AWAITING_REEVALUATION';
  observations?: string;
  clinic?: string;
  doctor?: string;
  dentalinkId?: number | null;
  dentalinkClinic?: string | null;
  createdAt: string;
  updatedAt: string;
  clinicalRecords?: ClinicalRecord[];
  patientImages?: PatientImage[];
  pipelineStage?: 'REQUIRED_FILES' | 'IN_PRODUCTION' | 'READY_FOR_PICKUP' | 'IN_TREATMENT' | 'REEVALUATION' | 'ENDING_SOON' | null;
  pipelineOverride?: string | null;
  pipelineIsManual?: boolean;
  alignerBatches?: AlignerBatch[];
  reevaluations?: Reevaluation[];
  whatsappOptedIn?: boolean;
  whatsappOptedInAt?: string | null;
  unreadMessagesCount?: number;
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


export interface ModelSet {
  id: string;
  takenAt: string;
  label?: string | null;
  upperKey?: string | null;
  lowerKey?: string | null;
  upperSize?: number | null;
  lowerSize?: number | null;
  patientId: string;
  createdAt: string;
  updatedAt: string;
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

export type ProductionStage =
  | 'RECEIVED'
  | 'PRINTING_MODELS'
  | 'THERMOFORMING'
  | 'TRIMMING_POLISHING'
  | 'PACKAGING'
  | 'COMPLETED';

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
  productionStage?: ProductionStage | null;
  modelsPrinted?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  patientId: string;
  batchEvents?: BatchEvent[];
}

// Minimal patient projection the lab endpoints expose (no contact/clinical data).
export interface LabOrderPatient {
  id: string;
  fullName: string;
  dentalinkId?: number | null;
  dentalinkClinic?: string | null;
}

// Shape returned by GET /lab/orders (gooFileUrl is replaced by hasFiles).
export interface LabOrder extends Omit<AlignerBatch, 'gooFileUrl'> {
  orderNumber: string;
  hasFiles: boolean;
  patient: LabOrderPatient;
}

// Shape returned by GET /lab/patients: practice-wide roster for the Lab board.
export interface LabPatient extends LabOrderPatient {
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  currentAligner: number;
  totalAligners: number;
  alignerBatches: Pick<
    AlignerBatch,
    | 'id'
    | 'status'
    | 'productionStage'
    | 'modelsPrinted'
    | 'batchNumber'
    | 'alignerCount'
    | 'expectedDeliveryDate'
  >[];
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


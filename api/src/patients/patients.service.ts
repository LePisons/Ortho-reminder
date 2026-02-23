import { Injectable } from '@nestjs/common';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TwilioService } from '../twilio/twilio.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PatientsService {
  // Inject both PrismaService and TwilioService so we can use them
  constructor(
    private prisma: PrismaService,
    private twilioService: TwilioService,
  ) {}

  // This method now needs to be async to handle the message sending
  async create(createPatientDto: CreatePatientDto, userId: string) {
    let batchStartDateObj: Date | undefined = undefined;
    if (createPatientDto.batchStartDate) {
      batchStartDateObj = new Date(createPatientDto.batchStartDate + 'T00:00:00');
    }

    // Step 1: Create the patient in the database first
    const newPatient = await this.prisma.patient.create({
      data: {
        ...createPatientDto,
        userId: userId,
        // This forces the date to be interpreted as UTC midnight to prevent timezone bugs
        treatmentStartDate: new Date(
          createPatientDto.treatmentStartDate + 'T00:00:00',
        ),
        batchStartDate: batchStartDateObj,
        alignerBatches: (createPatientDto.totalAligners || 0) > 0 ? {
          create: [{
            status: 'NEEDED',
            alignerCount: createPatientDto.totalAligners,
            createdBy: userId,
            batchEvents: {
              create: [{
                toStatus: 'NEEDED',
                note: 'Initial batch created automatically',
                createdBy: userId,
              }]
            }
          }]
        } : undefined,
      },
    });

    // Step 2: After the patient is successfully created, try to send a welcome message
    try {
      const welcomeMessage = `¡Hola ${newPatient.fullName}! Bienvenido/a a tu tratamiento de ortodoncia. Recibirás recordatorios para cambiar tus alineadores. ¡Mucho éxito!`;

      // Use our reusable TwilioService to send the message
      await this.twilioService.sendWhatsApp(newPatient.phone, welcomeMessage);
    } catch (error) {
      // If sending the message fails, we don't want the whole operation to crash.
      // We log the error to the backend console for debugging, but the user still gets a success response.
      console.error(
        `Patient ${newPatient.fullName} was created, but the welcome message failed to send.`,
        error,
      );
    }

    // Step 3: Return the data for the newly created patient
    return this.mapPatientWithUrgency(newPatient);
  }

  async checkDuplicates(rut?: string, email?: string, phone?: string, userId?: string, excludePatientId?: string) {
    if (!userId) return { exists: false, conflicts: [] };
    
    // Build the OR conditions based on provided fields
    const orConditions: any[] = [];
    if (rut) orConditions.push({ rut });
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });

    // If no fields to check, return false
    if (orConditions.length === 0) return { exists: false, conflicts: [] };

    const whereClause: any = {
      userId,
      OR: orConditions
    };

    // If we are editing, we don't want to flag the patient themselves as a duplicate
    if (excludePatientId) {
      whereClause.id = { not: excludePatientId };
    }

    const existingPatient = await this.prisma.patient.findFirst({
      where: whereClause
    });

    if (!existingPatient) {
      return { exists: false, conflicts: [] };
    }

    // Determine which exact fields conflicted to tell the user
    const conflicts: string[] = [];
    if (rut && existingPatient.rut === rut) conflicts.push('RUT');
    if (email && existingPatient.email === email) conflicts.push('Email');
    if (phone && existingPatient.phone === phone) conflicts.push('Phone');

    return { exists: true, conflicts };
  }

  // The method now needs to accept page and limit, with defaults
  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit; // Calculate how many records to skip

    // We now run two queries: one for the data, one for the total count
    const [patients, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Always good to have a consistent order
        include: {
          alignerBatches: {
            where: { status: { notIn: ['DELIVERED_TO_CLINIC', 'HANDED_TO_PATIENT', 'CANCELLED'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          reevaluations: {
            where: { status: { in: ['NEEDED', 'SCAN_UPLOADED'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          }
        }
      }),
      this.prisma.patient.count(),
    ]);

    return {
      data: patients.map(p => this.mapPatientWithUrgency(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: id },
      include: {
        clinicalRecords: true,
        patientImages: true,
        alignerBatches: {
          where: { status: { notIn: ['DELIVERED_TO_CLINIC', 'HANDED_TO_PATIENT', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        reevaluations: {
          where: { status: { in: ['NEEDED', 'SCAN_UPLOADED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      },
    });
    return patient ? this.mapPatientWithUrgency(patient) : null;
  }

  // Note: The update method could also be modified to handle dates correctly if needed
  async update(id: string, updatePatientDto: UpdatePatientDto) {
    // 2. Create a correctly typed data object
    const dataToUpdate: Prisma.PatientUpdateInput = {
      ...updatePatientDto,
    };

    // 3. The 'if' check remains the same
    if (updatePatientDto.treatmentStartDate) {
      dataToUpdate.treatmentStartDate = new Date(
        updatePatientDto.treatmentStartDate + 'T00:00:00',
      );
    }

    if (updatePatientDto.batchStartDate) {
      dataToUpdate.batchStartDate = new Date(
        updatePatientDto.batchStartDate + 'T00:00:00',
      );
    }

    const updated = await this.prisma.patient.update({
      where: { id },
      data: dataToUpdate, // 4. Now this assignment is safe!
    });
    
    return this.mapPatientWithUrgency(updated);
  }

  remove(id: string) {
    return this.prisma.patient.delete({
      where: { id },
    });
  }

  async getStats() {
    const total = await this.prisma.patient.count();
    const active = await this.prisma.patient.count({
      where: { status: 'ACTIVE' },
    });
    const paused = await this.prisma.patient.count({
      where: { status: 'PAUSED' },
    });
    const finished = await this.prisma.patient.count({
      where: { status: 'FINISHED' },
    });

    return { total, active, paused, finished };
  }

  async getPipeline() {
    const activePatients = await this.prisma.patient.findMany({
      where: { status: 'ACTIVE' },
      include: {
        alignerBatches: {
          where: { status: { notIn: ['HANDED_TO_PATIENT', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        reevaluations: {
          where: { status: { in: ['NEEDED', 'SCAN_UPLOADED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    });

    const mappedPatients = activePatients.map(p => this.mapPatientWithUrgency(p));
    
    // Group patients by pipelineStage
    const pipeline = {
      ENDING_SOON: [] as any[],
      ORDER_SENT: [] as any[],
      IN_PRODUCTION: [] as any[],
      READY_FOR_PICKUP: [] as any[],
      REEVALUATION: [] as any[],
    };

    mappedPatients.forEach(patient => {
      if (patient.pipelineStage && pipeline[patient.pipelineStage as keyof typeof pipeline]) {
        pipeline[patient.pipelineStage as keyof typeof pipeline].push(patient);
      }
    });

    return pipeline;
  }

  async findUpcomingChanges(page: number = 1, limit: number = 5) {
    const activePatients = await this.prisma.patient.findMany({
      where: { status: 'ACTIVE' },
      include: {
        alignerBatches: {
          where: { status: { notIn: ['DELIVERED_TO_CLINIC', 'HANDED_TO_PATIENT', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        reevaluations: {
          where: { status: { in: ['NEEDED', 'SCAN_UPLOADED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const patientsWithNextChange = activePatients.map((patient) => {
      const startDate = new Date(patient.treatmentStartDate);
      const timeDiff = today.getTime() - startDate.getTime();
      const daysSinceStart = Math.floor(timeDiff / (1000 * 3600 * 24));

      const remainder =
        daysSinceStart >= 0 ? daysSinceStart % patient.changeFrequency : 0;
      const daysUntilNextChange = patient.changeFrequency - remainder;

      const nextChangeDate = new Date(today);
      nextChangeDate.setDate(today.getDate() + daysUntilNextChange);

      const currentAligner = patient.currentAligner || 1;

      return {
        id: patient.id,
        fullName: patient.fullName,
        daysUntilNextChange,
        nextChangeDate,
        currentAligner,
      };
    });

    // Sort patients by who is closest to their next change
    const sortedPatients = patientsWithNextChange.sort(
      (a, b) => a.daysUntilNextChange - b.daysUntilNextChange,
    );

    // Manually apply pagination to the sorted array
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedData = sortedPatients.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: sortedPatients.length,
      page,
      limit,
      totalPages: Math.ceil(sortedPatients.length / limit),
    };
  }
  async uploadAvatar(id: string, url: string) {
    return this.prisma.patient.update({
      where: { id },
      data: { avatarUrl: url },
    });
  }

  // Helper method to compute urgencyStatus and append to patient objects
  private mapPatientWithUrgency(patient: any) {
    if (!patient) return null;
    
    let urgencyStatus = 'ON_TRACK';
    if (!patient.totalAligners || patient.totalAligners === 0) {
      urgencyStatus = 'AWAITING_REEVALUATION';
    } else if (patient.batchStartDate && patient.wearDaysPerAligner) {
      const expectedEndDate = new Date(patient.batchStartDate);
      // Wait, is it total aligners or current? The user requested total.
      expectedEndDate.setDate(expectedEndDate.getDate() + (patient.totalAligners * patient.wearDaysPerAligner));
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = expectedEndDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
      
      if (diffDays < 0) {
        urgencyStatus = 'OVERDUE';
      } else if (diffDays <= 14) {
        urgencyStatus = 'ENDING_SOON';
      }
    } else {
       urgencyStatus = 'ON_TRACK'; 
    }

    let pipelineStage: string | null = null;
    const activeBatch = patient.alignerBatches?.[0];
    const activeReeval = patient.reevaluations?.[0];

    // Priority 1: Active Re-evaluation
    if (activeReeval) {
      pipelineStage = 'REEVALUATION';
    } 
    // Priority 2: Active Batch in Pipeline
    else if (activeBatch) {
      if (activeBatch.status === 'ORDER_SENT') {
        pipelineStage = 'ORDER_SENT';
      } else if (activeBatch.status === 'IN_PRODUCTION') {
        pipelineStage = 'IN_PRODUCTION';
      } else if (activeBatch.status === 'DELIVERED_TO_CLINIC') {
        pipelineStage = 'READY_FOR_PICKUP';
      }
    } 
    // Priority 3: Ending Soon (derived from Urgency)
    else if (urgencyStatus === 'ENDING_SOON' || urgencyStatus === 'OVERDUE') {
      pipelineStage = 'ENDING_SOON';
    }

    return {
      ...patient,
      urgencyStatus,
      pipelineStage,
    };
  }
}

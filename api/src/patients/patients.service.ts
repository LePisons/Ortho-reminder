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
    // Step 1: Create the patient in the database first
    const newPatient = await this.prisma.patient.create({
      data: {
        ...createPatientDto,
        userId: userId,
        // This forces the date to be interpreted as UTC midnight to prevent timezone bugs
        treatmentStartDate: new Date(
          createPatientDto.treatmentStartDate + 'T00:00:00',
        ),
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
    return newPatient;
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
      }),
      this.prisma.patient.count(),
    ]);

    return {
      data: patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  findOne(id: string) {
    return this.prisma.patient.findUnique({
      where: { id: id },
      include: {
        clinicalRecords: true,
        patientImages: true,
      },
    });
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

    return this.prisma.patient.update({
      where: { id },
      data: dataToUpdate, // 4. Now this assignment is safe!
    });
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

  async findUpcomingChanges(page: number = 1, limit: number = 5) {
    const activePatients = await this.prisma.patient.findMany({
      where: { status: 'ACTIVE' },
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

      const currentAligner =
        daysSinceStart >= 0
          ? Math.floor(daysSinceStart / patient.changeFrequency) + 1
          : 1;

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
}

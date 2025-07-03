import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TwilioService } from '../twilio/twilio.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private twilioService: TwilioService,
  ) {}

  async create(createPatientDto: CreatePatientDto, userId: string) {
    const newPatient = await this.prisma.patient.create({
      data: {
        ...createPatientDto,
        treatmentStartDate: new Date(
          createPatientDto.treatmentStartDate + 'T00:00:00',
        ),
        userId: userId,
      },
    });

    try {
      const welcomeMessage = `¡Hola ${newPatient.fullName}! Bienvenido/a a tu tratamiento de ortodoncia. Recibirás recordatorios para cambiar tus alineadores. ¡Mucho éxito!`;
      await this.twilioService.sendWhatsApp(newPatient.phone, welcomeMessage);
    } catch (error) {
      console.error(
        `Patient ${newPatient.fullName} was created, but the welcome message failed to send.`,
        error,
      );
    }

    return newPatient;
  }

  async findAll(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const where = { userId };

    const [patients, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data: patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id, userId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with ID "${id}" not found`);
    }
    return patient;
  }

  async update(id: string, updatePatientDto: UpdatePatientDto, userId: string) {
    // First, ensure the patient belongs to the user
    await this.findOne(id, userId);

    const dataToUpdate: Prisma.PatientUpdateInput = {
      ...updatePatientDto,
    };

    if (updatePatientDto.treatmentStartDate) {
      dataToUpdate.treatmentStartDate = new Date(
        updatePatientDto.treatmentStartDate + 'T00:00:00',
      );
    }

    return this.prisma.patient.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.patient.delete({
      where: { id },
    });
  }

  async getStats(userId: string) {
    const where = { userId };
    const total = await this.prisma.patient.count({ where });
    const active = await this.prisma.patient.count({
      where: { ...where, status: 'ACTIVE' },
    });
    const paused = await this.prisma.patient.count({
      where: { ...where, status: 'PAUSED' },
    });
    const finished = await this.prisma.patient.count({
      where: { ...where, status: 'FINISHED' },
    });

    return { total, active, paused, finished };
  }

  async findUpcomingChanges(
    userId: string,
    page: number = 1,
    limit: number = 5,
  ) {
    const activePatients = await this.prisma.patient.findMany({
      where: { userId, status: 'ACTIVE' },
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

    const sortedPatients = patientsWithNextChange.sort(
      (a, b) => a.daysUntilNextChange - b.daysUntilNextChange,
    );

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

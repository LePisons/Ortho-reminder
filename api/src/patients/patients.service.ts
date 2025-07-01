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
  async create(createPatientDto: CreatePatientDto) {
    // Step 1: Create the patient in the database first
    const newPatient = await this.prisma.patient.create({
      data: {
        ...createPatientDto,
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

  findAll() {
    return this.prisma.patient.findMany();
  }

  findOne(id: string) {
    return this.prisma.patient.findUnique({
      where: { id: id },
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
}

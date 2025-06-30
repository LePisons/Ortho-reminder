// In api/src/reminder/reminder.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Twilio } from 'twilio';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);
  private readonly twilioClient: Twilio;

  constructor(private prisma: PrismaService) {
    // Initialize the Twilio client with credentials from the .env file
    this.twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  // This CRON job will run every day at 9 AM.
  // For testing, you can change it to CronExpression.EVERY_MINUTE
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'aligner_reminders',
    timeZone: 'America/Santiago', // IMPORTANT: Set to your local timezone
  })
  async handleCron() {
    this.logger.log('Running daily aligner reminder check...');

    // 1. Get all ACTIVE patients from the database
    const activePatients = await this.prisma.patient.findMany({
      where: { status: 'ACTIVE' },
    });

    this.logger.log(`Found ${activePatients.length} active patients to check.`);

    // 2. Loop through each patient to see if they need a reminder
    for (const patient of activePatients) {
      const startDate = patient.treatmentStartDate;
      const today = new Date();

      // Calculate the number of days since treatment started
      const timeDiff = today.getTime() - startDate.getTime();
      const daysSinceStart = Math.floor(timeDiff / (1000 * 3600 * 24));

      // Check if today is a reminder day (and not the very first day)
      if (
        daysSinceStart > 0 &&
        daysSinceStart % patient.changeFrequency === 0
      ) {
        // Calcular el número de alienador en el que se encuentra

        const alignerNumber = daysSinceStart / patient.changeFrequency + 1;
        const messageBody = `¡Hola ${patient.fullName}! Es hora de cambiar a tu alineador número ${alignerNumber}. ¡Sigue así!`;
        const logContent = `Reminder for Aligner #${alignerNumber}.`;

        const alreadySent = await this.prisma.messageLog.findFirst({
          where: {
            patientId: patient.id,
            messageContent: `Reminder for Aligner #${alignerNumber}.`,
          },
        });

        if (alreadySent) {
          this.logger.log(
            `Reminder for Aligner #${alignerNumber} already sent to ${patient.fullName}. Skipping.`,
          );
          continue; // 'continue' moves to the next patient in the loop
        }

        this.logger.log(`Sending reminder to ${patient.fullName}...`);

        // 3. Send the WhatsApp message
        try {
          const message = await this.twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: `whatsapp:${patient.phone}`, // Patient's phone number
            body: messageBody,
          });

          this.logger.log(
            `Message sent successfully to ${patient.fullName}. SID: ${message.sid}`,
          );

          // 4. Log the message to our own database
          await this.prisma.messageLog.create({
            data: {
              patientId: patient.id,
              status: 'SENT',
              messageContent: logContent,
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to send message to ${patient.fullName}`,
            error,
          );
        }
      }
    }
    this.logger.log('Reminder check finished.');
  }
}

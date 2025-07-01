// In api/src/reminder/reminder.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Twilio } from 'twilio';
import { TwilioService } from '../twilio/twilio.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);
  private readonly twilioClient: Twilio;

  constructor(
    private prisma: PrismaService,
    private twilioService: TwilioService, // <-- Inject here
  ) {}

  // This CRON job will run every day at 9 AM.

  @Cron(CronExpression.EVERY_30_SECONDS, {
    name: 'aligner_reminders',
    timeZone: 'America/Santiago',
  })
  async handleCron() {
    this.logger.log('Running daily aligner reminder check...');

    const activePatients = await this.prisma.patient.findMany({
      where: { status: 'ACTIVE' },
    });

    this.logger.log(`Found ${activePatients.length} active patients to check.`);

    for (const patient of activePatients) {
      const startDate = patient.treatmentStartDate;
      const today = new Date();

      const timeDiff = today.getTime() - startDate.getTime();
      const daysSinceStart = Math.floor(timeDiff / (1000 * 3600 * 24));

      if (
        daysSinceStart > 0 &&
        daysSinceStart % patient.changeFrequency === 0
      ) {
        const alignerNumber = daysSinceStart / patient.changeFrequency + 1;

        // THIS IS THE CRUCIAL PART YOU IDENTIFIED
        const logContent = `Reminder for Aligner #${alignerNumber}.`;

        const alreadySent = await this.prisma.messageLog.findFirst({
          where: {
            patientId: patient.id,
            messageContent: logContent, // We use it here for the check
          },
        });

        if (alreadySent) {
          this.logger.log(
            `Reminder for Aligner #${alignerNumber} already sent to ${patient.fullName}. Skipping.`,
          );
          continue;
        }

        const messageBody = `¡Hola ${patient.fullName}! Es hora de cambiar a tu alineador número ${alignerNumber}. ¡Sigue así!`;

        this.logger.log(
          `Sending reminder for Aligner #${alignerNumber} to ${patient.fullName}...`,
        );

        try {
          // Use the new, reusable TwilioService
          await this.twilioService.sendWhatsApp(patient.phone, messageBody);

          // Log the message to our own database using the specific content
          await this.prisma.messageLog.create({
            data: {
              patientId: patient.id,
              status: 'SENT',
              messageContent: logContent, // We use it here for the log
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

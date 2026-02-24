import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageTemplateService } from './message-template.service';
import { NotificationJob } from './notification-dispatcher.service';
import { MessageChannel, MessageTemplateType } from '@prisma/client';

@Injectable()
export class TriggerEvaluatorService {
  private readonly logger = new Logger(TriggerEvaluatorService.name);

  constructor(
    private prisma: PrismaService,
    private templateService: MessageTemplateService,
  ) {}

  async evaluate(): Promise<NotificationJob[]> {
    const jobs: NotificationJob[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Patients where nextReminderAt <= today
    const alignerChangePatients = await this.prisma.alignerChangeEvent.findMany(
      {
        where: { nextReminderAt: { lte: today } },
        include: { patient: true },
      },
    );

    const alignerTemplate = await this.templateService.findByType(
      MessageTemplateType.ALIGNER_CHANGE_REMINDER,
    );

    if (alignerTemplate) {
      for (const event of alignerChangePatients) {
        if (!event.patient.whatsappOptedIn) continue;

        // Idempotency check
        const alreadySent = await this.prisma.messageLog.findFirst({
          where: {
            patientId: event.patientId,
            templateId: alignerTemplate.id,
            createdAt: { gte: today },
          },
        });

        if (!alreadySent) {
          jobs.push({
            patientId: event.patientId,
            templateType: MessageTemplateType.ALIGNER_CHANGE_REMINDER,
            template: alignerTemplate,
            channel: MessageChannel.WHATSAPP,
            recipient: `whatsapp:+${event.patient.phone}`,
            variables: {
              patient_name: event.patient.fullName,
              aligner_number: event.alignerNumber + 1,
            },
            triggeredBy: 'cron',
          });
        }
      }
    }

    // TODO: Evaluate future cases when other services are implemented
    // (2) appointments within 48hrs and 2hrs
    // (3) batches where `expectedDeliveryDate` has passed
    // (4) batches where predicted end date < urgency threshold
    // (5) patients at exactly 50% aligner completion
    // (6) Monday only: weekly pipeline summary

    return jobs;
  }
}

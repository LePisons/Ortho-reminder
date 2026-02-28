import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageTemplateService } from './message-template.service';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { EmailProvider } from './providers/email.provider';
import { MessageChannel, MessageStatus, MessageTemplate } from '@prisma/client';

export interface NotificationJob {
  patientId: string;
  templateType: string;
  template: MessageTemplate;
  channel: MessageChannel;
  recipient: string;
  variables: Record<string, any>;
  triggeredBy: string;
  subject?: string;
}

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private prisma: PrismaService,
    private templateService: MessageTemplateService,
    private whatsappProvider: WhatsAppProvider,
    private emailProvider: EmailProvider,
  ) {}

  async dispatch(job: NotificationJob): Promise<void> {
    const provider =
      job.channel === MessageChannel.EMAIL
        ? this.emailProvider
        : this.whatsappProvider;

    const renderedContent = this.templateService.render(
      job.template,
      job.variables,
    );

    // Initial log
    const logEntry = await this.prisma.messageLog.create({
      data: {
        patientId: job.patientId,
        templateId: job.template.id,
        channel: job.channel,
        recipient: job.recipient,
        content: renderedContent,
        status: MessageStatus.PENDING,
        triggeredBy: job.triggeredBy,
      },
    });

    try {
      const result = await provider.send(
        job.recipient,
        renderedContent,
        job.subject, // Passed strictly to email provider usually
      );

      await this.prisma.messageLog.update({
        where: { id: logEntry.id },
        data: {
          status: result.success ? MessageStatus.SENT : MessageStatus.FAILED,
          error: result.error || null,
          providerMessageId: result.externalId || null,
        },
      });
      
      this.logger.log(`Dispatched ${job.templateType} to ${job.recipient} via ${job.channel}`);
    } catch (error) {
      await this.prisma.messageLog.update({
        where: { id: logEntry.id },
        data: {
          status: MessageStatus.FAILED,
          error: error.message,
        },
      });
      this.logger.error(`Dispatch failed for job ${job.templateType}`, error);
    }
  }
}

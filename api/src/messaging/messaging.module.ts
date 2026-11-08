import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailProvider } from './providers/email.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { MessageTemplateService } from './message-template.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { TriggerEvaluatorService } from './trigger-evaluator.service';
import { CronService } from './cron.service';
import { WhatsAppWebhookController } from './whatsapp.controller';
import { AlignerService } from '../patients/aligner.service';

@Module({
  imports: [PrismaModule],
  controllers: [WhatsAppWebhookController],
  providers: [
    EmailProvider,
    WhatsAppProvider,
    MessageTemplateService,
    NotificationDispatcherService,
    TriggerEvaluatorService,
    CronService,
    AlignerService,
  ],
  exports: [
    MessageTemplateService,
    NotificationDispatcherService,
  ],
})
export class MessagingModule {}

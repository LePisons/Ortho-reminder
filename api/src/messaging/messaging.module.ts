import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailProvider } from './providers/email.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { MessageTemplateService } from './message-template.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { TriggerEvaluatorService } from './trigger-evaluator.service';
import { CronService } from './cron.service';
import { WhatsAppWebhookController } from './whatsapp.controller';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [WhatsAppWebhookController],
  providers: [
    EmailProvider,
    WhatsAppProvider,
    MessageTemplateService,
    NotificationDispatcherService,
    TriggerEvaluatorService,
    CronService,
  ],
  exports: [
    MessageTemplateService,
    NotificationDispatcherService,
  ],
})
export class MessagingModule {}

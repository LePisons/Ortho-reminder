import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailProvider } from './providers/email.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { MessageTemplateService } from './message-template.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { TriggerEvaluatorService } from './trigger-evaluator.service';
import { CronService } from './cron.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
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

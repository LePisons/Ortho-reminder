import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CombinedAuthGuard } from './auth/combined-auth.guard';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { PatientsModule } from './patients/patients.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReminderService } from './reminder/reminder.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TwilioService } from './twilio/twilio.service';
import { MessageLogModule } from './message-log/message-log.module';
import { AuthService } from './auth/auth.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ClinicalRecordsModule } from './clinical-records/clinical-records.module';
import { PatientImagesModule } from './patient-images/patient-images.module';
import { NotesModule } from './notes/notes.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { TodoistModule } from './integrations/todoist/todoist.module';
import { DentalinkModule } from './integrations/dentalink/dentalink.module';
import { AlignerBatchesModule } from './aligner-batches/aligner-batches.module';
import { ReevaluationsModule } from './reevaluations/reevaluations.module';
import { MessagingModule } from './messaging/messaging.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { SettingsModule } from './settings/settings.module';
import { MessageTemplatesModule } from './message-templates/message-templates.module';
import { StorageModule } from './storage/storage.module';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute window
        limit: 120, // default cap per IP
      },
    ]),
    StorageModule,
    AuditModule,
    PatientsModule,
    ScheduleModule.forRoot(),
    MessageLogModule,
    UsersModule,
    PrismaModule,
    AuthModule,
    ClinicalRecordsModule,
    PatientImagesModule,
    NotesModule,
    AppointmentsModule,
    TodoistModule,
    DentalinkModule,
    AlignerBatchesModule,
    ReevaluationsModule,
    MessagingModule,
    OnboardingModule,
    SettingsModule,
    MessageTemplatesModule,
    ApiKeysModule,
  ],
  controllers: [HealthController],
  providers: [
    ReminderService,
    TwilioService,
    // Authenticate every route by default; opt out with @Public().
    // Accepts cookie/Bearer JWTs and `ork_` API keys (see CombinedAuthGuard).
    {
      provide: APP_GUARD,
      useClass: CombinedAuthGuard,
    },
    // Rate-limit every route; tighten specific routes with @Throttle()
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

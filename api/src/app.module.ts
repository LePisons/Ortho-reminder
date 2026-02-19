import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [],
  providers: [ReminderService, TwilioService],
})
export class AppModule {}

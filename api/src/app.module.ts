import { Module } from '@nestjs/common';
import { PatientsModule } from './patients/patients.module';
import { PrismaService } from './prisma/prisma.service'; // This import is correct, the issue is likely elsewhere if it's a "cannot find module" error.
import { ReminderService } from './reminder/reminder.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TwilioService } from './twilio/twilio.service';
import { MessageLogModule } from './message-log/message-log.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PatientsModule, ScheduleModule.forRoot(), MessageLogModule, AuthModule, UsersModule],
  controllers: [],
  providers: [PrismaService, ReminderService, TwilioService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { PatientsModule } from './patients/patients.module';
import { PrismaService } from './prisma/prisma.service'; // This import is correct, the issue is likely elsewhere if it's a "cannot find module" error.
import { ReminderService } from './reminder/reminder.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PatientsModule, ScheduleModule.forRoot()],
  controllers: [],
  providers: [PrismaService, ReminderService],
})
export class AppModule {}

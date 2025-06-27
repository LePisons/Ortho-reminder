import { Module } from '@nestjs/common';
import { PatientsModule } from './patients/patients.module';
import { PrismaService } from './prisma/prisma.service'; // This import is correct, the issue is likely elsewhere if it's a "cannot find module" error.

@Module({
  imports: [PatientsModule],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}

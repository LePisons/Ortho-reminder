import { Module } from '@nestjs/common';
import { ClinicalRecordsService } from './clinical-records.service';
import { ClinicalRecordsController } from './clinical-records.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ClinicalRecordsController],
  providers: [ClinicalRecordsService, PrismaService],
})
export class ClinicalRecordsModule {}

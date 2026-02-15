import { Module } from '@nestjs/common';
import { PatientImagesService } from './patient-images.service';
import { PatientImagesController } from './patient-images.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PatientImagesController],
  providers: [PatientImagesService, PrismaService],
})
export class PatientImagesModule {}

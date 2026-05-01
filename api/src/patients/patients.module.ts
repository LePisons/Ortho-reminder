import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingModule } from '../messaging/messaging.module';
import { AlignerService } from './aligner.service';

@Module({
  imports: [MessagingModule],
  controllers: [PatientsController],
  providers: [PatientsService, PrismaService, AlignerService],
  exports: [AlignerService],
})
export class PatientsModule {}

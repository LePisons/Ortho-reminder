import { Module } from '@nestjs/common';
import { PresentationsService } from './presentations.service';
import { PresentationsController } from './presentations.controller';
import { SlideTemplatesService } from './slide-templates.service';
import { SlideTemplatesController } from './slide-templates.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PresentationsController, SlideTemplatesController],
  providers: [PresentationsService, SlideTemplatesService, PrismaService],
})
export class PresentationsModule {}

import { Module } from '@nestjs/common';
import { ModelSetsService } from './model-sets.service';
import { ModelSetsController } from './model-sets.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ModelSetsController],
  providers: [ModelSetsService, PrismaService],
})
export class ModelSetsModule {}

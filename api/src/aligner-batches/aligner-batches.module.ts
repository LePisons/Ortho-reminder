import { Module } from '@nestjs/common';
import { AlignerBatchesService } from './aligner-batches.service';
import { AlignerBatchesController } from './aligner-batches.controller';

@Module({
  providers: [AlignerBatchesService],
  controllers: [AlignerBatchesController]
})
export class AlignerBatchesModule {}

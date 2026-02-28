import { Module } from '@nestjs/common';
import { AlignerBatchesService } from './aligner-batches.service';
import { AlignerBatchesController } from './aligner-batches.controller';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [MessagingModule],
  providers: [AlignerBatchesService],
  controllers: [AlignerBatchesController]
})
export class AlignerBatchesModule {}

import { Module } from '@nestjs/common';
import { ReevaluationsService } from './reevaluations.service';
import { ReevaluationsController } from './reevaluations.controller';

@Module({
  providers: [ReevaluationsService],
  controllers: [ReevaluationsController]
})
export class ReevaluationsModule {}

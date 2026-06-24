import { Module } from '@nestjs/common';
import { DentalinkService } from './dentalink.service';
import { DentalinkController } from './dentalink.controller';

@Module({
  controllers: [DentalinkController],
  providers: [DentalinkService],
  exports: [DentalinkService],
})
export class DentalinkModule {}

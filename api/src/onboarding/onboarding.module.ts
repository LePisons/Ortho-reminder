import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { AlignerService } from '../patients/aligner.service';

@Module({
  imports: [PrismaModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, AlignerService],
})
export class OnboardingModule {}

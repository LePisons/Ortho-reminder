import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlignerService } from '../patients/aligner.service';

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private alignerService: AlignerService,
  ) {}

  async validateToken(token: string) {
    const onboardingToken = await this.prisma.onboardingToken.findUnique({
      where: { token },
      include: { patient: true },
    });

    if (!onboardingToken) {
      throw new NotFoundException('Token not found');
    }

    if (onboardingToken.usedAt) {
      // Return specific state so the frontend can say "You are already registered"
      return { status: 'already_used', patient: onboardingToken.patient };
    }

    if (new Date() > onboardingToken.expiresAt) {
      throw new BadRequestException('Token has expired');
    }

    return { status: 'valid', patient: onboardingToken.patient };
  }

  async optIn(token: string) {
    const { status, patient } = await this.validateToken(token);

    if (status === 'already_used') {
      return { success: true, message: 'Already opted in' };
    }

    // Process opt-in
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark token as used
      await tx.onboardingToken.update({
        where: { token },
        data: { usedAt: new Date() },
      });

      // 2. Enable WhatsApp + set trackingStartedAt if not already set
      const updateData: any = {
        whatsappOptedIn: true,
        whatsappOptedInAt: new Date(),
        trackingStartedAt: (patient as any).trackingStartedAt || new Date(),
      };

      // Only set currentAligner to 1 if tracking has not started yet
      // (AlignerService will handle the write + anchor below)
      await tx.patient.update({
        where: { id: patient.id },
        data: updateData,
      });
    });

    // 3. Set currentAligner through the single write path (only if not yet started)
    if (patient.currentAligner === 0) {
      await this.alignerService.setCurrentAligner(
        patient.id,
        1,
        new Date(),
        'onboarding',
      );
    }

    return { success: true };
  }
}

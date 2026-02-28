import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

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

      const isStartingNow = patient.currentAligner === 0;
      // We manually cast to any to bypass a Prisma typings cache issue where trackingStartedAt is unrecognised 
      // despite the successful DB migration. 
      const updateData: any = {
        whatsappOptedIn: true,
        whatsappOptedInAt: new Date(),
        trackingStartedAt: (patient as any).trackingStartedAt || new Date(),
        currentAligner: isStartingNow ? 1 : patient.currentAligner,
      };

      await tx.patient.update({
        where: { id: patient.id },
        data: updateData,
      });

      // 3. Create the first AlignerChangeEvent setting the next Reminder directly
      const nextReminderDate = new Date();
      nextReminderDate.setDate(
        nextReminderDate.getDate() + patient.wearDaysPerAligner,
      );

      await tx.alignerChangeEvent.create({
        data: {
          patientId: patient.id,
          alignerNumber: isStartingNow ? 1 : patient.currentAligner,
          confirmedAt: new Date(),
          confirmedBy: 'auto_onboarding',
          nextReminderAt: nextReminderDate,
        },
      });
    });

    return { success: true };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AlignerChangeReason =
  | 'manual_adjustment'
  | 'manual_start'
  | 'onboarding'
  | 'cron'
  | 'patient_reply';

@Injectable()
export class AlignerService {
  constructor(private prisma: PrismaService) {}

  /**
   * THE single write path for currentAligner in the entire application.
   *
   * Rules:
   * - Clamps the value between 1 and totalAligners
   * - Persists currentAligner + lastAlignerSetAt atomically
   * - Always creates an AlignerChangeEvent audit record
   *
   * @param patientId - patient to update
   * @param newAligner - desired aligner number (will be clamped)
   * @param setDate    - the date this aligner was put in (defaults to today)
   * @param reason     - audit reason for the change
   */
  async setCurrentAligner(
    patientId: string,
    newAligner: number,
    setDate: Date = new Date(),
    reason: AlignerChangeReason = 'manual_adjustment',
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    // Clamp: never go below 1, never exceed totalAligners (if set)
    const maxAligner = patient.totalAligners > 0 ? patient.totalAligners : newAligner;
    const clamped = Math.max(1, Math.min(newAligner, maxAligner));

    const wearDays = patient.wearDaysPerAligner || 14;
    const nextReminderAt = new Date(setDate.getTime() + wearDays * 24 * 60 * 60 * 1000);

    // Atomic write: update patient + create audit record in one transaction
    const [updatedPatient] = await this.prisma.$transaction([
      this.prisma.patient.update({
        where: { id: patientId },
        data: {
          currentAligner: clamped,
          lastAlignerSetAt: setDate,
        },
      }),
      this.prisma.alignerChangeEvent.create({
        data: {
          patientId,
          alignerNumber: clamped,
          confirmedAt: setDate,
          confirmedBy: reason,
          nextReminderAt,
        },
      }),
    ]);

    return updatedPatient;
  }
}

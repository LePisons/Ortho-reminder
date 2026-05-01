import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageTemplateService } from './message-template.service';
import { NotificationJob } from './notification-dispatcher.service';
import { MessageChannel, MessageTemplateType } from '@prisma/client';
import { AlignerService } from '../patients/aligner.service';

@Injectable()
export class TriggerEvaluatorService {
  private readonly logger = new Logger(TriggerEvaluatorService.name);

  constructor(
    private prisma: PrismaService,
    private templateService: MessageTemplateService,
    private alignerService: AlignerService,
  ) {}

  async evaluate(): Promise<NotificationJob[]> {
    const jobs: NotificationJob[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Load settings for batch ending threshold and emails
    const settings = await this.loadSettings();

    // 1. Aligner Change Reminders (EMAIL to patient)
    await this.evaluateAlignerChangeReminders(jobs, today, settings);

    // 2. Batch Ending Soon Alerts (EMAIL to lab tech + orthodontist)
    await this.evaluateBatchEndingAlerts(jobs, today, settings);

    // 3. End-of-Treatment Appointment (EMAIL to orthodontist + calendar event)
    await this.evaluateAppointmentNeeded(jobs, today, settings);

    return jobs;
  }

  /**
   * Load global settings from the DB
   */
  private async loadSettings(): Promise<Record<string, string>> {
    const allSettings = await this.prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const s of allSettings) {
      map[s.key] = s.value;
    }
    return map;
  }

  /**
   * 1. Aligner Change Reminders
   *
   * For every active patient with tracking started, checks if enough days have
   * elapsed since `lastAlignerSetAt` (the anchor). If >= wearDaysPerAligner,
   * the patient is due for a change.
   *
   * Crucially:
   * - A manual adjustment resets the anchor to today → cron won't fire again
   *   until a full wear period passes from that new anchor.
   * - The cron advances the anchor forward by exact wear-period steps so that
   *   future cycles are always calculated from the correct base.
   */
  private async evaluateAlignerChangeReminders(
    jobs: NotificationJob[],
    today: Date,
    settings: Record<string, string>,
  ) {
    const emailTemplate = await this.templateService.findByType(
      MessageTemplateType.ALIGNER_CHANGE_REMINDER,
    );

    // Filter: only EMAIL channel template
    const template = emailTemplate?.channel === MessageChannel.EMAIL
      ? emailTemplate
      : await this.prisma.messageTemplate.findFirst({
          where: {
            type: MessageTemplateType.ALIGNER_CHANGE_REMINDER,
            channel: MessageChannel.EMAIL,
            isActive: true,
          },
        });

    if (!template) {
      this.logger.warn('No active EMAIL template for ALIGNER_CHANGE_REMINDER');
      return;
    }

    const activePatients = await this.prisma.patient.findMany({
      where: {
        status: 'ACTIVE',
        trackingStartedAt: { not: null },
        totalAligners: { gt: 0 },
        currentAligner: { gt: 0 },
      },
    });

    for (const patient of activePatients) {
      if (!patient.email) continue;

      // Use lastAlignerSetAt as the anchor (falls back to trackingStartedAt for
      // patients that existed before this field was introduced)
      const anchor = (patient as any).lastAlignerSetAt ?? patient.trackingStartedAt;
      if (!anchor) continue;

      const anchorDate = new Date(anchor);
      anchorDate.setHours(0, 0, 0, 0);

      const wearDays = patient.wearDaysPerAligner || 14;
      const ms = 1000 * 60 * 60 * 24;
      const daysSinceAnchor = Math.floor((today.getTime() - anchorDate.getTime()) / ms);

      // Not yet due for a change
      if (daysSinceAnchor < wearDays) continue;

      // How many full aligner periods have passed since the anchor?
      const stepsToAdvance = Math.floor(daysSinceAnchor / wearDays);
      const nextAligner = patient.currentAligner + stepsToAdvance;

      // Don't send if beyond total aligners
      if (nextAligner > (patient.totalAligners || Infinity)) continue;

      // Idempotency: check if already sent today
      const alreadySent = await this.prisma.messageLog.findFirst({
        where: {
          patientId: patient.id,
          templateId: template.id,
          createdAt: { gte: today },
        },
      });

      if (!alreadySent) {
        jobs.push({
          patientId: patient.id,
          templateType: MessageTemplateType.ALIGNER_CHANGE_REMINDER,
          template,
          channel: MessageChannel.EMAIL,
          recipient: patient.email,
          variables: {
            patient_name: patient.fullName.split(' ')[0],
            aligner_number: nextAligner,
          },
          triggeredBy: 'cron',
          subject: `🦷 Hora de cambiar al alineador #${nextAligner}`,
        });

        // Advance anchor by (stepsToAdvance * wearDays) so future cycles
        // calculate from the correct base — without overriding manual adjustments
        const newAnchor = new Date(anchorDate.getTime() + stepsToAdvance * wearDays * ms);

        await this.alignerService.setCurrentAligner(
          patient.id,
          nextAligner,
          newAnchor,
          'cron',
        );

        this.logger.log(
          `Queued aligner change email for ${patient.fullName} → aligner #${nextAligner} (anchor advanced to ${newAnchor.toISOString().split('T')[0]})`,
        );
      }
    }
  }

  /**
   * 2. Batch Ending Soon Alerts
   * When a patient has <= threshold aligners remaining, alert the lab tech and orthodontist.
   * Also auto-create a calendar appointment for the predicted end date.
   */
  private async evaluateBatchEndingAlerts(
    jobs: NotificationJob[],
    today: Date,
    settings: Record<string, string>,
  ) {
    const threshold = parseInt(settings['batch_ending_threshold'] || '3', 10);
    const techEmail = settings['technician_email'];
    const orthoEmail = settings['orthodontist_email'];

    const template = await this.prisma.messageTemplate.findFirst({
      where: {
        type: MessageTemplateType.BATCH_ENDING_LAB_ALERT,
        channel: MessageChannel.EMAIL,
        isActive: true,
      },
    });

    if (!template) {
      this.logger.warn('No active EMAIL template for BATCH_ENDING_LAB_ALERT');
      return;
    }

    const activePatients = await this.prisma.patient.findMany({
      where: {
        status: 'ACTIVE',
        trackingStartedAt: { not: null },
        totalAligners: { gt: 0 },
        currentAligner: { gt: 0 },
      },
    });

    for (const patient of activePatients) {
      const alignersRemaining = (patient.totalAligners || 0) - (patient.currentAligner || 0);

      // Only trigger if within threshold and still has some left
      if (alignersRemaining > threshold || alignersRemaining <= 0) continue;

      const daysRemaining = alignersRemaining * (patient.wearDaysPerAligner || 14);

      // Idempotency: only send once per patient per day
      const alreadySentToday = await this.prisma.messageLog.findFirst({
        where: {
          patientId: patient.id,
          templateId: template.id,
          createdAt: { gte: today },
        },
      });

      if (alreadySentToday) continue;

      // Check if we've already sent this specific alert (once per batch ending phase)
      // Use a wider check: any BATCH_ENDING_LAB_ALERT in the last 7 days
      const recentlySent = await this.prisma.messageLog.findFirst({
        where: {
          patientId: patient.id,
          templateId: template.id,
          createdAt: {
            gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentlySent) continue;

      const variables = {
        patient_name: patient.fullName,
        current_aligner: patient.currentAligner,
        total_aligners: patient.totalAligners,
        aligners_remaining: alignersRemaining,
        days_remaining: daysRemaining,
      };

      // Email to lab technician
      if (techEmail) {
        jobs.push({
          patientId: patient.id,
          templateType: MessageTemplateType.BATCH_ENDING_LAB_ALERT,
          template,
          channel: MessageChannel.EMAIL,
          recipient: techEmail,
          variables,
          triggeredBy: 'cron',
          subject: `⚠️ Stock bajo — ${patient.fullName} (${alignersRemaining} alineadores restantes)`,
        });
      }

      // Email to orthodontist
      if (orthoEmail) {
        jobs.push({
          patientId: patient.id,
          templateType: MessageTemplateType.BATCH_ENDING_LAB_ALERT,
          template,
          channel: MessageChannel.EMAIL,
          recipient: orthoEmail,
          variables,
          triggeredBy: 'cron',
          subject: `⚠️ Paciente ${patient.fullName} — batch por terminar`,
        });
      }

      // Auto-create calendar appointment for predicted end date
      await this.createEndOfTreatmentAppointment(patient, daysRemaining, today);

      this.logger.log(
        `Queued batch ending alerts for ${patient.fullName} (${alignersRemaining} aligners remaining)`,
      );
    }
  }

  /**
   * 3. End-of-Treatment Appointment Needed
   * When the last aligner is about to end, send email reminder to orthodontist.
   */
  private async evaluateAppointmentNeeded(
    jobs: NotificationJob[],
    today: Date,
    settings: Record<string, string>,
  ) {
    const orthoEmail = settings['orthodontist_email'];

    const template = await this.prisma.messageTemplate.findFirst({
      where: {
        type: MessageTemplateType.APPOINTMENT_NEEDED,
        channel: MessageChannel.EMAIL,
        isActive: true,
      },
    });

    if (!template || !orthoEmail) return;

    // Find patients on their last aligner
    const patientsOnLastAligner = await this.prisma.patient.findMany({
      where: {
        status: 'ACTIVE',
        trackingStartedAt: { not: null },
        totalAligners: { gt: 0 },
      },
    });

    for (const patient of patientsOnLastAligner) {
      if ((patient.currentAligner || 0) !== (patient.totalAligners || 0)) continue;

      // calculate estimated end date
      const wearDays = patient.wearDaysPerAligner || 14;
      const estimatedEndDate = new Date(today);
      estimatedEndDate.setDate(estimatedEndDate.getDate() + wearDays);

      // Idempotency: check if already sent in last 14 days
      const recentlySent = await this.prisma.messageLog.findFirst({
        where: {
          patientId: patient.id,
          templateId: template.id,
          createdAt: {
            gte: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentlySent) continue;

      jobs.push({
        patientId: patient.id,
        templateType: MessageTemplateType.APPOINTMENT_NEEDED,
        template,
        channel: MessageChannel.EMAIL,
        recipient: orthoEmail,
        variables: {
          patient_name: patient.fullName,
          current_aligner: patient.currentAligner,
          total_aligners: patient.totalAligners,
          estimated_end_date: estimatedEndDate.toLocaleDateString('es-CL'),
        },
        triggeredBy: 'cron',
        subject: `📅 Cita necesaria — ${patient.fullName} (fin de tratamiento)`,
      });

      // Also auto-create appointment
      await this.createEndOfTreatmentAppointment(patient, wearDays, today);

      this.logger.log(
        `Queued appointment-needed email for ${patient.fullName}`,
      );
    }
  }

  /**
   * Helper: Auto-create a calendar appointment for end-of-treatment
   */
  private async createEndOfTreatmentAppointment(
    patient: { id: string; fullName: string },
    daysUntilEnd: number,
    today: Date,
  ) {
    const appointmentDate = new Date(today);
    appointmentDate.setDate(appointmentDate.getDate() + daysUntilEnd);

    // Set appointment time to 10:00 AM
    appointmentDate.setHours(10, 0, 0, 0);
    const endTime = new Date(appointmentDate);
    endTime.setHours(11, 0, 0, 0);

    // Check if appointment already exists for this patient around that date (±3 days)
    const existingAppointment = await this.prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        start: {
          gte: new Date(appointmentDate.getTime() - 3 * 24 * 60 * 60 * 1000),
          lte: new Date(appointmentDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
        status: { not: 'CANCELLED' },
      },
    });

    if (existingAppointment) {
      this.logger.log(
        `Appointment already exists for ${patient.fullName} around ${appointmentDate.toISOString()}`,
      );
      return;
    }

    // Create the appointment
    await this.prisma.appointment.create({
      data: {
        title: `Cita final de tratamiento — ${patient.fullName}`,
        start: appointmentDate,
        end: endTime,
        allDay: false,
        status: 'SCHEDULED',
        description: `Cita auto-generada: el paciente ${patient.fullName} está por finalizar su tratamiento con alineadores.`,
        patientId: patient.id,
      },
    });

    this.logger.log(
      `Auto-created appointment for ${patient.fullName} on ${appointmentDate.toLocaleDateString('es-CL')}`,
    );
  }
}

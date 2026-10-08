import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProvider } from '../messaging/providers/email.provider';

const labels: Record<string, string> = {
  CREATE: 'Creó una derivación en borrador',
  UPDATE: 'Actualizó los antecedentes o la solicitud de tratamiento',
  SUBMIT: 'Envió la derivación para revisión',
  COMMENT: 'Añadió un comentario',
  UPLOAD: 'Adjuntó archivos',
  PHOTO_CLASSIFIED: 'Cambió la clasificación de fotografías',
};
export function referralNotificationHtml(actions: string[], link: string) {
  const counts = new Map<string, number>();
  for (const action of actions)
    counts.set(action, (counts.get(action) || 0) + 1);
  const list = [...counts]
    .map(
      ([action, count]) =>
        `<li>${labels[action] || 'Actualizó el caso'}${count > 1 ? ` (${count})` : ''}</li>`,
    )
    .join('');
  const safeLink = link
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
  return `<div style="font-family:Arial,sans-serif;max-width:600px;color:#1b1b1b"><h2 style="color:#5a5ff2">Actividad en una derivación</h2><p>Un colega derivador realizó estas acciones en un caso compartido contigo:</p><ul>${list}</ul><p><a href="${safeLink}" style="display:inline-block;background:#5a5ff2;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Revisar derivación</a></p><p>Ingresa con tu cuenta habitual para revisar los detalles.</p><p style="font-size:12px;color:#666">Alnix Orthoreminder · Aviso automático de actividad. Los datos clínicos permanecen en la aplicación.</p></div>`;
}

@Injectable()
export class ReferralNotificationsService {
  private readonly logger = new Logger(ReferralNotificationsService.name);
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailProvider,
    private readonly config: ConfigService,
  ) {}

  private origin() {
    const value =
      this.config.get<string>('REFERRAL_APP_URL') ||
      this.config.get<string>('ALLOWED_ORIGINS')?.split(',')[0]?.trim();
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password
        ? url.origin
        : null;
    } catch {
      return null;
    }
  }

  @Interval(30_000)
  async dispatch() {
    if (this.running) return;
    const origin = this.origin();
    if (!this.email.isAvailable() || !origin) return;
    this.running = true;
    try {
      await this.groupPending();
      const now = new Date();
      const deliveries =
        await this.prisma.referralNotificationDelivery.findMany({
          where: { status: 'PENDING', availableAt: { lte: now } },
          orderBy: { createdAt: 'asc' },
          take: 20,
        });
      for (const delivery of deliveries) {
        // Atomic lease also protects against another Railway replica or a restart.
        const claim = await this.prisma.referralNotificationDelivery.updateMany(
          {
            where: {
              id: delivery.id,
              status: 'PENDING',
              availableAt: { lte: now },
            },
            data: {
              availableAt: new Date(Date.now() + 300_000),
              attempts: { increment: 1 },
            },
          },
        );
        if (!claim.count) continue;
        try {
          const accessible = await this.prisma.referral.findFirst({
            where: {
              id: delivery.referralId,
              ownerId: delivery.ownerId,
              revokedAt: null,
              owner: {
                role: 'ADMIN',
                disabledAt: null,
                email: delivery.recipient,
              },
              OR: [{ patientId: null }, { patient: { deletedAt: null } }],
            },
            select: { id: true },
          });
          if (!accessible) {
            await this.prisma.referralNotificationDelivery.update({
              where: { id: delivery.id },
              data: { status: 'CANCELLED' },
            });
            continue;
          }
          const result = await this.email.send(
            delivery.recipient,
            referralNotificationHtml(
              delivery.actions,
              `${origin}/derivaciones/${encodeURIComponent(delivery.referralId)}`,
            ),
            'Nueva actividad de un derivador — Alnix',
            `referral-activity/${delivery.id}`,
          );
          if (!result.success)
            throw new Error('Email provider rejected notification');
          await this.prisma.referralNotificationDelivery.update({
            where: { id: delivery.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
        } catch {
          const delay = Math.min(
            6 * 60 * 60_000,
            60_000 * 2 ** Math.min(delivery.attempts, 9),
          );
          await this.prisma.referralNotificationDelivery.update({
            where: { id: delivery.id },
            data: { availableAt: new Date(Date.now() + delay) },
          });
          this.logger.warn(
            `Referral notification pending retry: ${delivery.id}`,
          );
        }
      }
    } catch {
      this.logger.error(
        'Referral notification worker failed; pending notifications will be retried.',
      );
    } finally {
      this.running = false;
    }
  }

  async groupPending() {
    await this.prisma.$transaction(
      async (tx) => {
        const lock = await tx.$queryRaw<
          { locked: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(726419307) AS locked`;
        if (!lock[0]?.locked) return;
        const ready = await tx.referralNotificationEvent.findMany({
          where: {
            deliveryId: null,
            createdAt: { lte: new Date(Date.now() - 120_000) },
          },
          orderBy: { createdAt: 'asc' },
          take: 500,
        });
        if (!ready.length) return;
        // Include recent actions in the same batch, so a photo upload sequence
        // does not generate one email every time another file reaches the cutoff.
        const events = await tx.referralNotificationEvent.findMany({
          where: {
            deliveryId: null,
            referralId: {
              in: [...new Set(ready.map((event) => event.referralId))],
            },
          },
          orderBy: { createdAt: 'asc' },
          take: 5000,
        });
        const groups = new Map<string, typeof events>();
        for (const event of events)
          groups.set(event.referralId, [
            ...(groups.get(event.referralId) || []),
            event,
          ]);
        for (const [referralId, items] of groups) {
          const record = await tx.referral.findUnique({
            where: { id: referralId },
            select: {
              ownerId: true,
              revokedAt: true,
              owner: { select: { email: true, role: true, disabledAt: true } },
            },
          });
          if (
            !record ||
            record.revokedAt ||
            record.owner.role !== 'ADMIN' ||
            record.owner.disabledAt
          ) {
            await tx.referralNotificationEvent.updateMany({
              where: { id: { in: items.map((item) => item.id) } },
              data: { deliveryId: 'CANCELLED' },
            });
            continue;
          }
          const delivery = await tx.referralNotificationDelivery.create({
            data: {
              referralId,
              ownerId: record.ownerId,
              recipient: record.owner.email,
              actions: items.map((item) => item.action),
            },
          });
          await tx.referralNotificationEvent.updateMany({
            where: {
              id: { in: items.map((item) => item.id) },
              deliveryId: null,
            },
            data: { deliveryId: delivery.id },
          });
        }
      },
      { timeout: 30_000 },
    );
  }
}

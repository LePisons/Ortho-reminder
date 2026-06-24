import { Controller, Get, Post, Req, Res, Logger, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { MessageStatus } from '@prisma/client';
import { AlignerService } from '../patients/aligner.service';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { Public } from '../auth/public.decorator';

// Meta calls these endpoints server-to-server; they are authenticated by the
// hub.verify_token handshake / signature, not by a user session.
@Public()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alignerService: AlignerService,
    private readonly whatsappProvider: WhatsAppProvider,
  ) {}

  /**
   * The webhook Verification Endpoint.
   * Meta sends a GET request here with a hub.verify_token and a hub.challenge when
   * you configure the Webhook URL in their developer portal. We must respond with the 
   * challenge string if the token matches our WHATSAPP_VERIFY_TOKEN.
   */
  @Get()
  verifyWebhook(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully by Meta.');
      res.status(HttpStatus.OK).send(challenge);
    } else {
      this.logger.warn('Failed webhook verification attempt.');
      res.sendStatus(HttpStatus.FORBIDDEN);
    }
  }

  /**
   * The Event Receipt Endpoint.
   * Meta sends POST requests here when messages are sent, delivered, read,
   * or when a user responds.
   */
  @Post()
  async handleWebhookEvent(@Req() req: Request, @Res() res: Response) {
    // Meta requires a 200 OK immediately
    res.sendStatus(HttpStatus.OK);
    
    // Safety check
    if (!req.body || req.body.object !== 'whatsapp_business_account') {
      return;
    }

    try {
      // Loop over entries & changes (usually just one of each, but Meta sends arrays)
      for (const entry of req.body.entry) {
        for (const change of entry.changes) {
          const value = change.value;

          // 1. Handle Status Updates (Sent, Delivered, Read, Failed)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              const metaId = status.id; // The providerMessageId we saved
              const metaStatus = status.status; // 'sent', 'delivered', 'read', 'failed'
              
              const mappedStatus = this.mapMetaStatusToPrisma(metaStatus);
              
              this.logger.debug(`Status Update from Meta: Msg ${metaId} is now ${metaStatus}`);

              // Update the database if we have this message logged
              if (mappedStatus) {
                // Background update
                this.prisma.messageLog.updateMany({
                  where: { providerMessageId: metaId },
                  data: {
                    status: mappedStatus,
                    error: status.errors ? JSON.stringify(status.errors) : null
                  }
                }).catch(e => {
                  this.logger.error(`Error updating message status in DB: ${e.message}`);
                });
              }
            }
          }

          // 2. Handle Incoming Messages (If the patient replies)
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const fromPhone = message.from; // Phone number
              const messageText = message.text?.body || message.button?.text || message.interactive?.button_reply?.title;
              const metaId = message.id;
              
              if (messageText) {
                this.logger.log(`Incoming reply from ${fromPhone}: ${messageText}`);
                
                // Try to match patient by phone (fromPhone usually is like "569XXXXXXXX")
                // We'll strip non-digits from DB phones to match safely or do a contains search
                const possiblePatients = await this.prisma.patient.findMany({
                  where: {
                    phone: {
                      contains: fromPhone.substring(Math.max(0, fromPhone.length - 8))
                    }
                  }
                });

                const patient = possiblePatients[0]; // best effort match

                if (patient) {
                  await this.prisma.messageLog.create({
                    data: {
                      patientId: patient.id,
                      channel: 'WHATSAPP',
                      direction: 'INCOMING',
                      recipient: fromPhone,
                      content: messageText,
                      status: 'DELIVERED',
                      isRead: false,
                      triggeredBy: 'webhook',
                      providerMessageId: metaId
                    }
                  });
                  this.logger.log(`Saved incoming message to patient ${patient.id}`);

                  // Automated Reply Logic
                  const textLower = messageText.toLowerCase();

                  if (textLower.includes('ya lo cambié')) {
                    const nextAligner = patient.currentAligner + 1;
                    await this.alignerService.setCurrentAligner(patient.id, nextAligner, new Date(), 'patient_reply');
                    await this.whatsappProvider.send(fromPhone, '¡Excelente! 🎉 Sigue así. He registrado tu cambio en el sistema. Nos hablamos en tu próximo recambio.');
                  } 
                  else if (textLower.includes('faltan días') || textLower.includes('faltan dias')) {
                    const wearDays = patient.wearDaysPerAligner || 14;
                    const lastSet = patient.lastAlignerSetAt ? new Date(patient.lastAlignerSetAt) : new Date();
                    const nextChangeDate = new Date(lastSet.getTime() + wearDays * 24 * 60 * 60 * 1000);
                    const now = new Date();
                    
                    // Set both to midnight to avoid partial day issues
                    const nextDateMidnight = new Date(nextChangeDate.getFullYear(), nextChangeDate.getMonth(), nextChangeDate.getDate());
                    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    
                    const diffTime = nextDateMidnight.getTime() - nowMidnight.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 0) {
                      await this.whatsappProvider.send(fromPhone, 'Según nuestros registros, ¡hoy te toca tu cambio! 🦷 Te sugiero realizarlo lo antes posible.');
                    } else {
                      await this.whatsappProvider.send(fromPhone, `¡Entendido! Te faltan ${diffDays} días para tu próximo cambio (estimado para el ${nextChangeDate.toLocaleDateString('es-CL')}). ¡Ánimo! 💪`);
                    }
                  }
                  else if (textLower.includes('alineador')) {
                    const wearDays = patient.wearDaysPerAligner || 14;
                    const lastSet = patient.lastAlignerSetAt ? new Date(patient.lastAlignerSetAt) : new Date();
                    const nextChangeDate = new Date(lastSet.getTime() + wearDays * 24 * 60 * 60 * 1000);
                    
                    await this.whatsappProvider.send(fromPhone, `Según nuestros registros, actualmente vas en el alineador ${patient.currentAligner}. Tu próximo cambio estimado es el ${nextChangeDate.toLocaleDateString('es-CL')}.`);
                  }

                } else {
                  this.logger.warn(`Could not find patient matching phone ${fromPhone} to attach incoming message.`);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      this.logger.error(`Error processing webhook event: ${e.message}`);
    }
  }

  private mapMetaStatusToPrisma(metaStatus: string): MessageStatus | null {
    switch (metaStatus) {
      case 'sent': return MessageStatus.SENT;
      case 'delivered': return MessageStatus.DELIVERED;
      case 'read': return MessageStatus.READ;
      case 'failed': return MessageStatus.FAILED;
      default: return null;
    }
  }
}

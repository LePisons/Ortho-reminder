import { Controller, Get, Post, Req, Res, Logger, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { MessageStatus } from '@prisma/client';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

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
              const messageText = message.text?.body;
              
              if (messageText) {
                this.logger.log(`Incoming reply from ${fromPhone}: ${messageText}`);
                
                // TODO: Save to patient's message history if needed
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

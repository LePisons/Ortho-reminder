import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  IMessagingProvider,
  MessageResult,
} from '../interfaces/messaging.interface';

@Injectable()
export class EmailProvider implements IMessagingProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey || 're_dummy_key_do_not_use');
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') ||
      'Alnix | Dr. Pison <noreply@alnix.cl>';
  }

  isAvailable(): boolean {
    return !!this.configService.get<string>('RESEND_API_KEY');
  }

  async send(
    recipient: string,
    content: string,
    subject?: string,
  ): Promise<MessageResult> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: recipient,
        subject: subject ?? 'Solicitud de alineadores — Alnix',
        html: content,
      });

      if (result.error) {
        this.logger.error(`Resend API Error: ${result.error.message}`);
        return { success: false, error: result.error.message };
      }

      return { success: true, externalId: result.data?.id };
    } catch (error) {
      this.logger.error(`Failed to send email to ${recipient}`, error);
      return { success: false, error: error.message };
    }
  }
}

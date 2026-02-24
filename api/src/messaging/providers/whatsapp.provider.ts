import { Injectable, Logger } from '@nestjs/common';
import {
  IMessagingProvider,
  MessageResult,
} from '../interfaces/messaging.interface';

@Injectable()
export class WhatsAppProvider implements IMessagingProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  isAvailable(): boolean {
    return false; // Flip to true when Meta is configured
  }

  async send(recipient: string, content: string): Promise<MessageResult> {
    // TODO: Replace with Meta Cloud API call when credentials available
    this.logger.log(`[WHATSAPP STUB] To: ${recipient} | Content: ${content}`);
    return { success: false, error: 'WhatsApp provider not yet configured' };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import {
  IMessagingProvider,
  MessageResult,
} from '../interfaces/messaging.interface';

@Injectable()
export class WhatsAppProvider implements IMessagingProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  isAvailable(): boolean {
    return !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;
  }

  async send(recipient: string, content: string): Promise<MessageResult> {
    if (!this.isAvailable()) {
      return { success: false, error: 'WhatsApp Provider missing credentials in .env' };
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const apiUrl = `https://graph.facebook.com/v18.0/${phoneId}/messages`;

    // Ensure recipient has no non-numeric characters and starts with country code (e.g. 569...)
    const cleanRecipient = recipient.replace(/\D/g, '');

    let payload: any;
    
    // Check if the content is a JSON-stringified template definition
    try {
      const parsedContent = JSON.parse(content);
      if (parsedContent.type === 'template') {
        payload = {
          messaging_product: 'whatsapp',
          to: cleanRecipient,
          type: 'template',
          template: {
            name: parsedContent.template.name,
            language: { code: parsedContent.template.language?.code || 'es_CL' },
            components: parsedContent.template.components || [],
          },
        };
      } else {
        throw new Error('Not a template'); // fallback to simple text
      }
    } catch (e) {
      // Send as simple text message (Not a template)
      // Note: Free-form text only works if an active 24h customer service window is open!
      payload = {
        messaging_product: 'whatsapp',
        to: cleanRecipient,
        type: 'text',
        text: { body: content },
      };
    }

    try {
      this.logger.debug(`[Meta API] Sending to ${cleanRecipient} via ${phoneId}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        this.logger.error(`[Meta API Error] ${JSON.stringify(responseData)}`);
        return { 
          success: false, 
          error: responseData.error?.message || 'Failed to send WhatsApp message',
          externalId: undefined 
        };
      }

      const messageId = responseData.messages?.[0]?.id;
      this.logger.log(`[Meta API Success] Message sent with ID: ${messageId}`);
      
      return { 
        success: true, 
        externalId: messageId 
      };
      
    } catch (error) {
      this.logger.error(`[WhatsApp API Exception] ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly twilioClient?: Twilio;

  constructor() {
    // Initialize the Twilio client once, right here
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      // Twilio is an optional integration; don't crash the whole app at boot
      // when it isn't configured. sendWhatsApp() will fail clearly if used.
      this.logger.warn(
        'Twilio credentials not set; WhatsApp sending via Twilio is disabled',
      );
      return;
    }

    this.twilioClient = new Twilio(accountSid, authToken);
    this.logger.log('Twilio client initialized');
  }

  // Create a public method to send messages
  async sendWhatsApp(to: string, body: string) {
    if (!this.twilioClient) {
      throw new Error(
        'Twilio is not configured (set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)',
      );
    }
    try {
      const from = process.env.TWILIO_WHATSAPP_NUMBER;
      const message = await this.twilioClient.messages.create({
        from,
        to: `whatsapp:${to}`,
        body,
      });
      this.logger.log(`Message sent successfully. SID: ${message.sid}`);
      return message;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message to ${to}`, error);
      throw error; // Re-throw the error to be handled by the calling service
    }
  }
}

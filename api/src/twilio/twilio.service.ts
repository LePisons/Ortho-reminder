import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly twilioClient: Twilio;

  constructor() {
    // Initialize the Twilio client once, right here
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials are not defined in .env file');
    }

    this.twilioClient = new Twilio(accountSid, authToken);
    this.logger.log('Twilio client initialized');
  }

  // Create a public method to send messages
  async sendWhatsApp(to: string, body: string) {
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

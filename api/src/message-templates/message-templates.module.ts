import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { MessageTemplatesController } from './message-templates.controller';

@Module({
  imports: [MessagingModule],
  controllers: [MessageTemplatesController],
})
export class MessageTemplatesModule {}

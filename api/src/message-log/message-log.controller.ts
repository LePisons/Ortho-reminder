import { Controller, Get } from '@nestjs/common';
import { MessageLogService } from './message-log.service';

@Controller('message-log')
export class MessageLogController {
  constructor(private readonly messageLogService: MessageLogService) {}

  @Get()
  findAll() {
    return this.messageLogService.findAll();
  }
}

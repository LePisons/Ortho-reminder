import { Module } from '@nestjs/common';
import { MessageLogService } from './message-log.service';
import { MessageLogController } from './message-log.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MessageLogController],
  providers: [MessageLogService, PrismaService],
})
export class MessageLogModule {}

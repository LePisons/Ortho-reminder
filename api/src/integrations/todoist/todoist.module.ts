import { Module } from '@nestjs/common';
import { TodoistService } from './todoist.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TodoistService],
  exports: [TodoistService],
})
export class TodoistModule {}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessageLogService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.messageLog.findMany({
      // Order by the most recent messages first
      orderBy: {
        sentAt: 'desc',
      },
      // Include the related patient's data in the response
      include: {
        patient: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessageLogService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.messageLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        template: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });
  }
}

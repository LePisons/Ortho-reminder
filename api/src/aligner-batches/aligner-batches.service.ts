import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchStatus, AlignerBatch } from '@prisma/client';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

const VALID_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  NEEDED: [BatchStatus.ORDER_SENT, BatchStatus.CANCELLED],
  ORDER_SENT: [BatchStatus.IN_PRODUCTION, BatchStatus.NEEDED, BatchStatus.CANCELLED],
  IN_PRODUCTION: [BatchStatus.DELIVERED_TO_CLINIC, BatchStatus.CANCELLED],
  DELIVERED_TO_CLINIC: [BatchStatus.HANDED_TO_PATIENT, BatchStatus.CANCELLED],
  HANDED_TO_PATIENT: [], // Terminal
  CANCELLED: [], // Terminal
};

@Injectable()
export class AlignerBatchesService {
  constructor(private prisma: PrismaService) {}

  async create(createBatchDto: CreateBatchDto, userId: string) {
    // 1. Verify patient belongs to user
    const patient = await this.prisma.patient.findUnique({
      where: { id: createBatchDto.patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    if (patient.userId !== userId) {
      throw new ForbiddenException();
    }

    // Prisma creates the row, partial unique index enforces only one active batch.
    return this.prisma.alignerBatch.create({
      data: {
        ...createBatchDto,
        createdBy: userId,
         // The initial creation event logic handles itself without a fromStatus
        batchEvents: {
          create: [{
            toStatus: BatchStatus.NEEDED,
            note: 'Batch created',
            createdBy: userId,
          }],
        }
      },
    });
  }

  async findAllForPatient(patientId: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient || patient.userId !== userId) {
      throw new ForbiddenException();
    }

    return this.prisma.alignerBatch.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        batchEvents: { orderBy: { createdAt: 'desc' } },
      }
    });
  }

  async findOne(id: string, userId: string) {
    const batch = await this.prisma.alignerBatch.findUnique({
      where: { id },
      include: { patient: true, batchEvents: { orderBy: { createdAt: 'desc' } } },
    });

    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.patient.userId !== userId) throw new ForbiddenException();

    return batch;
  }

  async update(id: string, updateBatchDto: UpdateBatchDto, userId: string) {
    const batch = await this.findOne(id, userId); // Also handles auth check
    return this.prisma.alignerBatch.update({
      where: { id },
      data: updateBatchDto,
    });
  }

  private async transitionState(
    id: string,
    toStatus: BatchStatus,
    userId: string,
    action: (batch: AlignerBatch) => any,
  ) {
    const batch = await this.findOne(id, userId);
    const fromStatus = batch.status;

    // Validate the state machine
    if (!VALID_TRANSITIONS[fromStatus].includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition batch from ${fromStatus} to ${toStatus}`,
      );
    }

    // Enforce alignerCount validation for sending orders
    if (fromStatus === BatchStatus.NEEDED && toStatus === BatchStatus.ORDER_SENT) {
      if (batch.alignerCount <= 0) {
        throw new BadRequestException('Aligner count must be greater than 0 to send order');
      }
    }

    // Perform transition and create event log within a transaction
    return this.prisma.$transaction(async (prisma) => {
      const updatedBatch = await prisma.alignerBatch.update({
        where: { id },
        data: {
          status: toStatus,
          ...action(batch),
        },
      });

      await prisma.batchEvent.create({
        data: {
          batchId: id,
          fromStatus,
          toStatus,
          createdBy: userId,
        },
      });

      return updatedBatch;
    });
  }

  async sendOrder(id: string, expectedDeliveryDate: Date, userId: string) {
    return this.transitionState(id, BatchStatus.ORDER_SENT, userId, () => ({
      orderDate: new Date(),
      expectedDeliveryDate,
    }));
  }

  async markInProduction(id: string, userId: string) {
    return this.transitionState(id, BatchStatus.IN_PRODUCTION, userId, () => ({}));
  }

  async markDeliveredToClinic(id: string, actualDeliveryDate: Date, userId: string) {
    return this.transitionState(id, BatchStatus.DELIVERED_TO_CLINIC, userId, () => ({
      actualDeliveryDate,
    }));
  }

  async handToPatient(id: string, userId: string) {
    return this.transitionState(id, BatchStatus.HANDED_TO_PATIENT, userId, () => ({}));
  }

  async cancel(id: string, userId: string) {
    return this.transitionState(id, BatchStatus.CANCELLED, userId, () => ({}));
  }
}

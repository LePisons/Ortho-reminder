import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlignerBatch, BatchStatus, ProductionStage } from '@prisma/client';
import { UpdateProductionDto } from './dto/update-production.dto';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Batches the lab is (or should be) working on.
const ACTIVE_STATUSES: BatchStatus[] = [
  BatchStatus.ORDER_SENT,
  BatchStatus.IN_PRODUCTION,
];

const STAGE_LABELS: Record<ProductionStage, string> = {
  RECEIVED: 'Orden recibida',
  PRINTING_MODELS: 'Imprimiendo modelos',
  THERMOFORMING: 'Termoformado',
  TRIMMING_POLISHING: 'Recorte y pulido',
  PACKAGING: 'Empaque',
  COMPLETED: 'Producción completada',
};

// Only patient fields the lab needs; deliberately excludes contact/clinical data.
const LAB_PATIENT_SELECT = { id: true, fullName: true } as const;

@Injectable()
export class LabService {
  private s3Client: S3Client;

  constructor(private prisma: PrismaService) {
    const accountId = process.env.R2_ACCOUNT_ID || '';
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint:
        process.env.R2_ENDPOINT ||
        `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }

  // Same format the lab-order email uses (see aligner-batches.service.ts).
  private orderNumber(batch: AlignerBatch): string {
    const date = batch.createdAt || new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `ORD-${yy}${mm}${dd}-${batch.id.slice(-4).toUpperCase()}`;
  }

  private toOrderView(batch: AlignerBatch & { patient: { id: string; fullName: string } }) {
    const { gooFileUrl, ...rest } = batch;
    return {
      ...rest,
      orderNumber: this.orderNumber(batch),
      hasFiles: !!gooFileUrl,
    };
  }

  /**
   * Orders for the lab board: everything in ORDER_SENT / IN_PRODUCTION, plus
   * the last 30 days of finished work for reference. Not scoped by userId —
   * the lab serves the whole practice.
   */
  async listOrders() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [active, recent] = await Promise.all([
      this.prisma.alignerBatch.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        include: {
          patient: { select: LAB_PATIENT_SELECT },
          batchEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
        orderBy: { orderDate: 'asc' },
      }),
      this.prisma.alignerBatch.findMany({
        where: {
          status: {
            in: [BatchStatus.DELIVERED_TO_CLINIC, BatchStatus.HANDED_TO_PATIENT],
          },
          updatedAt: { gte: thirtyDaysAgo },
        },
        include: { patient: { select: LAB_PATIENT_SELECT } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      active: active.map((b) => this.toOrderView(b)),
      recentlyCompleted: recent.map((b) => this.toOrderView(b)),
    };
  }

  private async findActiveOrder(id: string) {
    const batch = await this.prisma.alignerBatch.findUnique({
      where: { id },
      include: { patient: { select: LAB_PATIENT_SELECT } },
    });
    if (!batch) throw new NotFoundException('Order not found');
    return batch;
  }

  /**
   * Lab technician progress update: production stage, models printed and/or
   * notes. First stage update on an ORDER_SENT batch also moves the batch to
   * IN_PRODUCTION so the clinic pipeline stays in sync. Every change is
   * recorded as a BatchEvent.
   */
  async updateProduction(id: string, dto: UpdateProductionDto, userId: string) {
    const batch = await this.findActiveOrder(id);

    if (!ACTIVE_STATUSES.includes(batch.status)) {
      throw new BadRequestException(
        `Order is ${batch.status}; only ORDER_SENT or IN_PRODUCTION orders can be updated`,
      );
    }

    const changes: string[] = [];
    if (dto.productionStage && dto.productionStage !== batch.productionStage) {
      changes.push(STAGE_LABELS[dto.productionStage]);
    }
    if (
      dto.modelsPrinted !== undefined &&
      dto.modelsPrinted !== batch.modelsPrinted
    ) {
      changes.push(`Modelos impresos: ${dto.modelsPrinted}/${batch.alignerCount}`);
    }
    if (
      dto.technicianNotes !== undefined &&
      dto.technicianNotes !== batch.technicianNotes
    ) {
      changes.push('Notas del técnico actualizadas');
    }
    if (changes.length === 0) {
      return this.toOrderView(batch);
    }

    // Any real production activity moves an ORDER_SENT batch to IN_PRODUCTION.
    const startProduction =
      batch.status === BatchStatus.ORDER_SENT &&
      (dto.productionStage !== undefined || dto.modelsPrinted !== undefined);
    const nextStatus = startProduction
      ? BatchStatus.IN_PRODUCTION
      : batch.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.alignerBatch.update({
        where: { id },
        data: {
          productionStage: dto.productionStage,
          modelsPrinted: dto.modelsPrinted,
          technicianNotes: dto.technicianNotes,
          status: nextStatus,
        },
        include: { patient: { select: LAB_PATIENT_SELECT } },
      });

      await tx.batchEvent.create({
        data: {
          batchId: id,
          fromStatus: batch.status,
          toStatus: nextStatus,
          note: changes.join(' · '),
          createdBy: userId,
        },
      });

      return result;
    });

    return this.toOrderView(updated);
  }

  /**
   * Fresh short-lived presigned link to the .goo print files. Replaces relying
   * on the 7-day link from the order email.
   */
  async getDownloadUrl(id: string) {
    const batch = await this.findActiveOrder(id);
    if (!batch.gooFileUrl) {
      throw new NotFoundException('This order has no uploaded print files');
    }

    // gooFileUrl is `<public domain>/<key>`; the key is the URL path.
    let key: string;
    try {
      key = decodeURIComponent(new URL(batch.gooFileUrl).pathname.slice(1));
    } catch {
      throw new BadRequestException('Stored file URL is malformed');
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });
    return { downloadUrl, expiresInSeconds: 3600 };
  }
}

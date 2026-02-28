import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchStatus, AlignerBatch, MessageChannel } from '@prisma/client';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NotificationDispatcherService } from '../messaging/notification-dispatcher.service';
import { MessageTemplateService } from '../messaging/message-template.service';

const VALID_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  NEEDED: [BatchStatus.ORDER_SENT, BatchStatus.IN_PRODUCTION, BatchStatus.CANCELLED],
  ORDER_SENT: [BatchStatus.IN_PRODUCTION, BatchStatus.NEEDED, BatchStatus.CANCELLED],
  IN_PRODUCTION: [BatchStatus.DELIVERED_TO_CLINIC, BatchStatus.CANCELLED],
  DELIVERED_TO_CLINIC: [BatchStatus.HANDED_TO_PATIENT, BatchStatus.CANCELLED],
  HANDED_TO_PATIENT: [], // Terminal
  CANCELLED: [], // Terminal
};

@Injectable()
export class AlignerBatchesService {
  private s3Client: S3Client;

  constructor(
    private prisma: PrismaService,
    private notificationDispatcher: NotificationDispatcherService,
  ) {
    const accountId = process.env.R2_ACCOUNT_ID || '';
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }

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
        include: {
          patient: true
        }
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

  // Generate an R2 presigned URL for the clinician to upload .goo / print files
  async generateUploadUrl(id: string, userId: string) {
    const batch = await this.findOne(id, userId);

    if (batch.status !== BatchStatus.NEEDED) {
      throw new BadRequestException('Cannot upload files for a batch that is not in NEEDED status');
    }

    const key = `batches/${batch.patientId}/${id}-${Date.now()}.zip`;

    // Expecting a zip file containing the .goo print files
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: 'application/zip', 
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return { uploadUrl: url, key };
  }

  // Webhook/Confirmation endpoint called by the frontend after R2 upload completes
  async confirmFilesUploaded(id: string, fileUrl: string, key: string, userId: string) {
    const batch = await this.findOne(id, userId);

    if (batch.status !== BatchStatus.NEEDED) {
      throw new BadRequestException('Cannot confirm upload for a batch that is not in NEEDED status');
    }

    // Secure domain validation (optional but recommended)
    // Only validate if R2_PUBLIC_DOMAIN is explicitly set
    const expectedDomain = process.env.R2_PUBLIC_DOMAIN;
    if (expectedDomain && !fileUrl.startsWith(expectedDomain)) {
       throw new BadRequestException('Invalid file URL domain');
    }

    const updatedBatch = await this.transitionState(id, BatchStatus.IN_PRODUCTION, userId, () => ({
      gooFileUrl: fileUrl,
      orderDate: new Date(), // Effectively records when it was sent to lab
    }));

    // Trigger Email Notification to Lab Technician
    try {
      let targetEmail = updatedBatch.technicianEmail;
      
      // Fallback to global setting if no specific email is defined on the batch
      if (!targetEmail) {
        const globalSetting = await this.prisma.setting.findUnique({
          where: { key: 'technician_email' }
        });
        if (globalSetting && globalSetting.value) {
          targetEmail = globalSetting.value;
        }
      }

      if (targetEmail) {
        const template = await this.prisma.messageTemplate.findFirst({
          where: { type: 'LAB_ORDER_REQUEST' },
        });

        if (template && template.isActive) {
          const patient = updatedBatch.patient;

          // Generate 7-day secure download link
          let secureDownloadLink = fileUrl;
          console.log(`[LAB_EMAIL] key received: "${key}", fileUrl: "${fileUrl}"`);
          if (key) {
             const getCommand = new GetObjectCommand({
               Bucket: process.env.R2_BUCKET_NAME,
               Key: key,
             });
             // 604800 seconds = 7 days
             secureDownloadLink = await getSignedUrl(this.s3Client, getCommand, { expiresIn: 604800 });
             console.log(`[LAB_EMAIL] Generated pre-signed URL: "${secureDownloadLink.substring(0, 100)}..."`);
          } else {
            console.warn('[LAB_EMAIL] No key provided, falling back to public fileUrl');
          }
          
          // Generate readable Order Number: ORD-YYMMDD-XXXX (last 4 chars of CUID)
          const date = updatedBatch.createdAt || new Date();
          const yy = String(date.getFullYear()).slice(-2);
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          const uidSlice = updatedBatch.id.slice(-4).toUpperCase();
          const orderNumber = `ORD-${yy}${mm}${dd}-${uidSlice}`;

          await this.notificationDispatcher.dispatch({
            patientId: patient.id,
            templateType: template.type,
            template: template,
            channel: MessageChannel.EMAIL,
            recipient: targetEmail as string,
            subject: `Nueva Solicitud de Laboratorio - Orden ${orderNumber} - ${patient.fullName}`,
            variables: {
              order_number: orderNumber,
              patient_name: patient.fullName,
              batch_number: updatedBatch.batchNumber,
              aligner_count: updatedBatch.alignerCount,
              clinic_name: 'Alnix Orthodontics',
              notes: updatedBatch.technicianNotes || 'Ninguna indicación adicional.',
              file_download_link: secureDownloadLink,
            },
            triggeredBy: 'manual', 
          });
        }
      }
    } catch (e) {
      console.error(`Failed to send lab notification email for batch ${id}:`, e);
      // We don't rollback the transition, just log the email failure.
    }

    return updatedBatch;
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

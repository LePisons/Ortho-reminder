import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReevaluationStatus } from '@prisma/client';
import { CreateReevaluationDto } from './dto/create-reevaluation.dto';
import { UpdateReevaluationDto, ScanUrlDto } from './dto/update-reevaluation.dto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class ReevaluationsService {
  private s3Client: S3Client;

  constructor(private prisma: PrismaService) {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async create(createDto: CreateReevaluationDto, userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: createDto.patientId },
    });

    if (!patient) throw new NotFoundException('Patient not found');
    if (patient.userId !== userId) throw new ForbiddenException();

    return this.prisma.reevaluation.create({
      data: {
        ...createDto,
        createdBy: userId,
      },
    });
  }

  async findAllForPatient(patientId: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient || patient.userId !== userId) throw new ForbiddenException();

    return this.prisma.reevaluation.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const reeval = await this.prisma.reevaluation.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!reeval) throw new NotFoundException('Reevaluation not found');
    if (reeval.patient.userId !== userId) throw new ForbiddenException();

    return reeval;
  }

  async update(id: string, updateDto: UpdateReevaluationDto, userId: string) {
    const reeval = await this.findOne(id, userId);
    return this.prisma.reevaluation.update({
      where: { id },
      data: updateDto,
    });
  }

  async generateUploadUrl(id: string, userId: string) {
    const reeval = await this.findOne(id, userId);

    if (reeval.status !== ReevaluationStatus.NEEDED) {
      throw new BadRequestException('Cannot upload scan for a re-evaluation that is not in NEEDED status');
    }

    const key = `scans/${reeval.patientId}/${id}-${Date.now()}.stl`;

    // Important: Architect feedback implemented.
    // ContentType is specified here so R2 inherently rejects non-STL files.
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: 'application/vnd.ms-pki.stl', 
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return { uploadUrl: url, key };
  }

  async confirmScanUploaded(id: string, scanUrlDto: ScanUrlDto, userId: string) {
    const reeval = await this.findOne(id, userId);

    if (reeval.status !== ReevaluationStatus.NEEDED) {
      throw new BadRequestException('Cannot confirm upload for a re-evaluation that is not in NEEDED status');
    }

    // Validate domain
    const expectedDomain = process.env.R2_PUBLIC_DOMAIN;
    if (expectedDomain && !scanUrlDto.scanFileUrl.startsWith(expectedDomain)) {
       throw new BadRequestException('Invalid scan file URL domain');
    }

    return this.prisma.reevaluation.update({
      where: { id },
      data: {
        status: ReevaluationStatus.SCAN_UPLOADED,
        scanDate: new Date(),
        scanFileUrl: scanUrlDto.scanFileUrl,
      },
    });
  }

  async approveReevaluation(id: string, userId: string) {
    const reeval = await this.findOne(id, userId);

    if (reeval.status !== ReevaluationStatus.SCAN_UPLOADED) {
      throw new BadRequestException('Cannot approve a re-evaluation without a scan');
    }

    return this.prisma.reevaluation.update({
      where: { id },
      data: {
        status: ReevaluationStatus.APPROVED,
        approvalDate: new Date(),
      },
    });
  }
}

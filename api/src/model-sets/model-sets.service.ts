import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { CreateModelSetDto } from './dto/create-model-set.dto';
import { UpdateModelSetDto } from './dto/update-model-set.dto';

export type Jaw = 'upper' | 'lower';

export const STL_CONTENT_TYPE = 'model/stl';

@Injectable()
export class ModelSetsService {
  constructor(
    private prisma: PrismaService,
    private r2: R2Service,
  ) {}

  private async assertPatientOwnership(patientId: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient || patient.deletedAt)
      throw new NotFoundException('Patient not found');
    if (patient.userId !== userId) throw new ForbiddenException();
    return patient;
  }

  private async assertSetOwnership(id: string, userId: string) {
    const set = await this.prisma.modelSet.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!set) throw new NotFoundException('Model set not found');
    if (set.patient.userId !== userId) throw new ForbiddenException();
    return set;
  }

  buildKey(patientId: string, jaw: Jaw): string {
    return `dental-models/${patientId}/${randomUUID()}-${jaw}.stl`;
  }

  async create(
    dto: CreateModelSetDto,
    userId: string,
    files: { jaw: Jaw; key: string; size: number }[],
  ) {
    await this.assertPatientOwnership(dto.patientId, userId);
    const upper = files.find((f) => f.jaw === 'upper');
    const lower = files.find((f) => f.jaw === 'lower');
    return this.prisma.modelSet.create({
      data: {
        patientId: dto.patientId,
        takenAt: dto.takenAt ? new Date(dto.takenAt) : undefined,
        label: dto.label,
        upperKey: upper?.key,
        upperSize: upper?.size,
        lowerKey: lower?.key,
        lowerSize: lower?.size,
      },
    });
  }

  async findAll(patientId: string, userId: string) {
    if (!patientId) throw new BadRequestException('patientId is required');
    await this.assertPatientOwnership(patientId, userId);
    return this.prisma.modelSet.findMany({
      where: { patientId },
      orderBy: { takenAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const { patient, ...set } = await this.assertSetOwnership(id, userId);
    return set;
  }

  /** Short-lived signed URLs, generated only when the viewer opens a set. */
  async signedUrls(id: string, userId: string) {
    const set = await this.assertSetOwnership(id, userId);
    const [upper, lower] = await Promise.all([
      set.upperKey ? this.r2.getSignedReadUrl(set.upperKey) : undefined,
      set.lowerKey ? this.r2.getSignedReadUrl(set.lowerKey) : undefined,
    ]);
    return { upper, lower };
  }

  /** Attach or replace one jaw's file; deletes the replaced R2 object. */
  async setJawFile(
    id: string,
    jaw: Jaw,
    userId: string,
    file: { key: string; size: number },
  ) {
    const set = await this.assertSetOwnership(id, userId);
    const oldKey = jaw === 'upper' ? set.upperKey : set.lowerKey;
    const updated = await this.prisma.modelSet.update({
      where: { id },
      data:
        jaw === 'upper'
          ? { upperKey: file.key, upperSize: file.size }
          : { lowerKey: file.key, lowerSize: file.size },
    });
    if (oldKey) {
      await this.r2.deleteObject(oldKey).catch(() => undefined);
    }
    return updated;
  }

  async update(id: string, dto: UpdateModelSetDto, userId: string) {
    await this.assertSetOwnership(id, userId);
    return this.prisma.modelSet.update({
      where: { id },
      data: {
        takenAt: dto.takenAt ? new Date(dto.takenAt) : undefined,
        label: dto.label,
        orientation: dto.orientation,
      },
    });
  }

  async remove(id: string, userId: string) {
    const set = await this.assertSetOwnership(id, userId);
    await Promise.all(
      [set.upperKey, set.lowerKey]
        .filter((k): k is string => !!k)
        .map((k) => this.r2.deleteObject(k).catch(() => undefined)),
    );
    return this.prisma.modelSet.delete({ where: { id } });
  }
}

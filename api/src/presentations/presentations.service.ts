import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { CreatePresentationDto } from './dto/create-presentation.dto';
import { UpdatePresentationDto } from './dto/update-presentation.dto';
import { extensionForContentType } from '../storage/image-validation';

@Injectable()
export class PresentationsService {
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

  private async assertOwnership(id: string, userId: string) {
    const deck = await this.prisma.presentation.findUnique({ where: { id } });
    if (!deck) throw new NotFoundException('Presentation not found');
    if (deck.userId !== userId) throw new ForbiddenException();
    return deck;
  }

  // ── Decks ────────────────────────────────────────────────────────────────

  async create(dto: CreatePresentationDto, userId: string) {
    await this.assertPatientOwnership(dto.patientId, userId);
    return this.prisma.presentation.create({
      data: {
        patientId: dto.patientId,
        userId,
        title: dto.title,
        slides: (dto.slides ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Decks for one patient, or every deck for the user when `patientId` is
   * omitted (the /presentaciones index). Slides are excluded from the list —
   * a deck's JSON can be large and the list only needs a count.
   */
  async findAll(userId: string, patientId?: string) {
    if (patientId) await this.assertPatientOwnership(patientId, userId);
    const decks = await this.prisma.presentation.findMany({
      where: { userId, ...(patientId ? { patientId } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: { patient: { select: { id: true, fullName: true } } },
    });
    return decks.map(({ slides, patient, ...deck }) => ({
      ...deck,
      patientName: patient.fullName,
      slideCount: Array.isArray(slides) ? slides.length : 0,
    }));
  }

  async findOne(id: string, userId: string) {
    return this.assertOwnership(id, userId);
  }

  async update(id: string, dto: UpdatePresentationDto, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.presentation.update({
      where: { id },
      data: {
        title: dto.title,
        slides:
          dto.slides === undefined
            ? undefined
            : (dto.slides as Prisma.InputJsonValue),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    // Assets cascade in the database; their R2 objects have to go explicitly.
    const assets = await this.prisma.presentationAsset.findMany({
      where: { presentationId: id },
      select: { key: true },
    });
    await Promise.all(
      assets.map((a) => this.r2.deleteObject(a.key).catch(() => undefined)),
    );
    return this.prisma.presentation.delete({ where: { id } });
  }

  // ── Assets ───────────────────────────────────────────────────────────────

  /**
   * Store an image that belongs to a deck (a 3D snapshot, or a picture dropped
   * straight onto a slide) rather than to the clinical record. A null
   * `presentationId` parks it in the user's slide library instead.
   */
  async createAsset(
    userId: string,
    file: { buffer: Buffer; size: number },
    contentType: string,
    presentationId?: string,
  ) {
    if (presentationId) await this.assertOwnership(presentationId, userId);
    const scope = presentationId ?? 'library';
    const key = `presentations/${userId}/${scope}/${randomUUID()}.${extensionForContentType(contentType)}`;
    await this.r2.putObject(key, file.buffer, contentType);
    try {
      return await this.prisma.presentationAsset.create({
        data: {
          key,
          contentType,
          size: file.size,
          userId,
          presentationId: presentationId ?? null,
        },
      });
    } catch (e) {
      await this.r2.deleteObject(key).catch(() => undefined);
      throw e;
    }
  }

  async findAsset(id: string, userId: string) {
    const asset = await this.prisma.presentationAsset.findUnique({
      where: { id },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.userId !== userId) throw new ForbiddenException();
    return asset;
  }

  async removeAsset(id: string, userId: string) {
    const asset = await this.findAsset(id, userId);
    await this.r2.deleteObject(asset.key).catch(() => undefined);
    return this.prisma.presentationAsset.delete({ where: { id } });
  }

  streamAsset(key: string) {
    if (!key) throw new BadRequestException('Asset has no stored object');
    return this.r2.getObject(key);
  }
}

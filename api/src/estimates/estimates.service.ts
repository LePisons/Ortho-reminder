import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from './dto/catalog-item.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';

// Seeded into each user's catalog on first read; prices in CLP, null = "Consultar".
const DEFAULT_CATALOG: { name: string; details: string; price: number | null }[] = [
  { name: 'Alineadores Basic (con setup)', details: '1-7 pares, incluye refinamiento hasta 3 pares', price: 350000 },
  { name: 'Alineadores Basic (sin setup)', details: '1-7 pares', price: 280000 },
  { name: 'Alineadores Standard (con setup)', details: '8-14 pares, incluye refinamiento hasta 6 pares', price: 470000 },
  { name: 'Alineadores Standard (sin setup)', details: '8-14 pares', price: 400000 },
  { name: 'Alineadores Advanced (con setup)', details: '15-24 pares, incluye refinamiento hasta 9 pares', price: 670000 },
  { name: 'Alineadores Advanced (sin setup)', details: '15-24 pares', price: 600000 },
  { name: 'Alineadores Advanced Plus', details: 'Más de 24 pares', price: null },
  { name: 'Alineadores de remplazo', details: 'Por unidad', price: 20000 },
  { name: 'Contenciones', details: 'Por unidad', price: 50000 },
  { name: 'Setup Virtual', details: 'Simulación digital del tratamiento', price: 70000 },
  { name: 'Instalación (por arcada)', details: 'Incluye attachments', price: 100000 },
  { name: 'Control mensual', details: '', price: 29000 },
];

@Injectable()
export class EstimatesService {
  constructor(
    private prisma: PrismaService,
    private r2: R2Service,
  ) {}

  private async assertEstimateOwnership(id: string, userId: string) {
    const estimate = await this.prisma.estimate.findUnique({ where: { id } });
    if (!estimate) throw new NotFoundException('Estimate not found');
    if (estimate.userId !== userId) throw new ForbiddenException();
    return estimate;
  }

  private async assertCatalogItemOwnership(id: string, userId: string) {
    const item = await this.prisma.serviceCatalogItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Catalog item not found');
    if (item.userId !== userId) throw new ForbiddenException();
    return item;
  }

  async assertPatientOwnership(patientId: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || patient.deletedAt) throw new NotFoundException('Patient not found');
    if (patient.userId !== userId) throw new ForbiddenException();
    return patient;
  }

  // ---- Catalog ----

  async findCatalog(userId: string) {
    const count = await this.prisma.serviceCatalogItem.count({ where: { userId } });
    if (count === 0) {
      await this.prisma.serviceCatalogItem.createMany({
        data: DEFAULT_CATALOG.map((item, i) => ({ ...item, sortOrder: i, userId })),
      });
    }
    return this.prisma.serviceCatalogItem.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  createCatalogItem(dto: CreateCatalogItemDto, userId: string) {
    return this.prisma.serviceCatalogItem.create({
      data: {
        name: dto.name,
        details: dto.details,
        price: dto.price ?? null,
        sortOrder: dto.sortOrder ?? 0,
        userId,
      },
    });
  }

  async updateCatalogItem(id: string, dto: UpdateCatalogItemDto, userId: string) {
    await this.assertCatalogItemOwnership(id, userId);
    return this.prisma.serviceCatalogItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.details !== undefined && { details: dto.details }),
        // Explicit null clears the price back to "Consultar"
        ...('price' in dto && { price: dto.price ?? null }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async removeCatalogItem(id: string, userId: string) {
    await this.assertCatalogItemOwnership(id, userId);
    return this.prisma.serviceCatalogItem.delete({ where: { id } });
  }

  // ---- Estimates ----

  create(args: {
    patientName: string;
    patientId?: string | null;
    totalClp?: number | null;
    pdfKey: string;
    data: Prisma.InputJsonValue;
    userId: string;
  }) {
    return this.prisma.estimate.create({
      data: {
        patientName: args.patientName,
        patientId: args.patientId ?? null,
        totalClp: args.totalClp ?? null,
        pdfKey: args.pdfKey,
        data: args.data,
        userId: args.userId,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.estimate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        patientName: true,
        patientId: true,
        status: true,
        totalClp: true,
        createdAt: true,
      },
    });
  }

  findOne(id: string, userId: string) {
    return this.assertEstimateOwnership(id, userId);
  }

  async getDownloadUrl(id: string, userId: string) {
    const estimate = await this.assertEstimateOwnership(id, userId);
    return { url: await this.r2.getSignedReadUrl(estimate.pdfKey) };
  }

  async updateStatus(id: string, dto: UpdateEstimateDto, userId: string) {
    await this.assertEstimateOwnership(id, userId);
    return this.prisma.estimate.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async remove(id: string, userId: string) {
    const estimate = await this.assertEstimateOwnership(id, userId);
    await this.r2.deleteObject(estimate.pdfKey).catch(() => undefined);
    return this.prisma.estimate.delete({ where: { id } });
  }
}

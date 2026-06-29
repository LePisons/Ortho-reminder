import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientImageDto } from './dto/create-patient-image.dto';
import { UpdatePatientImageDto } from './dto/update-patient-image.dto';
import { R2Service } from '../storage/r2.service';
import { PatientImage } from '@prisma/client';

@Injectable()
export class PatientImagesService {
  constructor(
    private prisma: PrismaService,
    private r2: R2Service,
  ) {}

  private async assertPatientOwnership(patientId: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || patient.deletedAt) throw new NotFoundException('Patient not found');
    if (patient.userId !== userId) throw new ForbiddenException();
    return patient;
  }

  private async assertImageOwnership(id: string, userId: string) {
    const image = await this.prisma.patientImage.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!image) throw new NotFoundException('Image not found');
    if (image.patient.userId !== userId) throw new ForbiddenException();
    return image;
  }

  // The stored `url` is an R2 object key. Legacy rows may hold an absolute
  // http(s) URL from the old disk-based storage — pass those through unchanged.
  private isLegacyUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  private async withSignedUrl(image: PatientImage): Promise<PatientImage> {
    if (!image?.url || this.isLegacyUrl(image.url)) {
      return image;
    }
    return { ...image, url: await this.r2.getSignedReadUrl(image.url) };
  }

  async create(createPatientImageDto: CreatePatientImageDto, userId: string) {
    await this.assertPatientOwnership(createPatientImageDto.patientId, userId);
    const image = await this.prisma.patientImage.create({
      data: createPatientImageDto,
    });
    // Return a signed URL so the client can render the new image immediately
    // without refetching the whole patient.
    return this.withSignedUrl(image);
  }

  async findAll(patientId: string, userId: string) {
    await this.assertPatientOwnership(patientId, userId);
    const images = await this.prisma.patientImage.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
    return Promise.all(images.map((img) => this.withSignedUrl(img)));
  }

  async findOne(id: string, userId: string) {
    const { patient, ...image } = await this.assertImageOwnership(id, userId);
    return this.withSignedUrl(image);
  }

  async update(id: string, updatePatientImageDto: UpdatePatientImageDto, userId: string) {
    await this.assertImageOwnership(id, userId);
    return this.prisma.patientImage.update({
      where: { id },
      data: updatePatientImageDto,
    });
  }

  async remove(id: string, userId: string) {
    const image = await this.assertImageOwnership(id, userId);
    if (image.url && !this.isLegacyUrl(image.url)) {
      await this.r2.deleteObject(image.url).catch(() => undefined);
    }
    return this.prisma.patientImage.delete({
      where: { id },
    });
  }

  // Delete all images for a specific patient on a specific date (ignoring time)
  async removeSession(patientId: string, date: string, userId: string) {
    await this.assertPatientOwnership(patientId, userId);
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const images = await this.prisma.patientImage.findMany({
      where: {
        patientId,
        date: { gte: startDate, lte: endDate },
      },
    });

    await Promise.all(
      images
        .filter((img) => img.url && !this.isLegacyUrl(img.url))
        .map((img) => this.r2.deleteObject(img.url).catch(() => undefined)),
    );

    return this.prisma.patientImage.deleteMany({
      where: {
        patientId,
        date: { gte: startDate, lte: endDate },
      },
    });
  }
}

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSlideTemplateDto,
  UpdateSlideTemplateDto,
} from './dto/slide-template.dto';

/**
 * The clinician's personal library of reusable explainer slides. Templates are
 * copied by value when inserted into a deck, so editing one here never rewrites
 * a presentation that has already been shown to a patient.
 */
@Injectable()
export class SlideTemplatesService {
  constructor(private prisma: PrismaService) {}

  private async assertOwnership(id: string, userId: string) {
    const template = await this.prisma.slideTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Slide template not found');
    if (template.userId !== userId) throw new ForbiddenException();
    return template;
  }

  findAll(userId: string) {
    return this.prisma.slideTemplate.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  create(dto: CreateSlideTemplateDto, userId: string) {
    return this.prisma.slideTemplate.create({
      data: {
        userId,
        title: dto.title,
        slide: dto.slide as Prisma.InputJsonValue,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateSlideTemplateDto, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.slideTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        slide:
          dto.slide === undefined
            ? undefined
            : (dto.slide as Prisma.InputJsonValue),
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.slideTemplate.delete({ where: { id } });
  }
}

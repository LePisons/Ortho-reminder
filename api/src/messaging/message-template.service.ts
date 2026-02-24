import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageTemplate, MessageTemplateType } from '@prisma/client';
import * as Mustache from 'mustache';

@Injectable()
export class MessageTemplateService {
  private readonly logger = new Logger(MessageTemplateService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<MessageTemplate[]> {
    return this.prisma.messageTemplate.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findByType(type: MessageTemplateType): Promise<MessageTemplate | null> {
    return this.prisma.messageTemplate.findFirst({
      where: { type, isActive: true },
    });
  }

  async findById(id: string): Promise<MessageTemplate> {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  render(template: MessageTemplate, variables: Record<string, any>): string {
    try {
      return Mustache.render(template.content, variables);
    } catch (error) {
      this.logger.error(
        `Error rendering template ${template.name}: ${error.message}`,
      );
      // Fallback: return unrendered template if mustache fails
      return template.content;
    }
  }

  async updateContent(id: string, content: string): Promise<MessageTemplate> {
    return this.prisma.messageTemplate.update({
      where: { id },
      data: { content },
    });
  }
}

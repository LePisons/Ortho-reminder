import { Controller, Get, Body, Put, Param } from '@nestjs/common';
import { MessageTemplateService } from '../messaging/message-template.service';

export interface UpdateTemplateDto {
  content: string;
}

@Controller('message-templates')
export class MessageTemplatesController {
  constructor(
    private readonly templateService: MessageTemplateService,
  ) {}

  @Get()
  async findAll() {
    return this.templateService.findAll();
  }

  @Put(':id')
  async updateContent(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.updateContent(id, dto.content);
  }
}

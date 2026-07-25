import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { SlideTemplatesService } from './slide-templates.service';
import {
  CreateSlideTemplateDto,
  UpdateSlideTemplateDto,
} from './dto/slide-template.dto';

@Controller('slide-templates')
export class SlideTemplatesController {
  constructor(private readonly templates: SlideTemplatesService) {}

  @Get()
  findAll(@Request() req) {
    return this.templates.findAll(req.user.userId);
  }

  @Post()
  create(@Body() dto: CreateSlideTemplateDto, @Request() req) {
    return this.templates.create(dto, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSlideTemplateDto,
    @Request() req,
  ) {
    return this.templates.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.templates.remove(id, req.user.userId);
  }
}

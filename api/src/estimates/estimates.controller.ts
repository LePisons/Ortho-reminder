import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { EstimatesService } from './estimates.service';
import { R2Service } from '../storage/r2.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from './dto/catalog-item.dto';

@Controller('estimates')
export class EstimatesController {
  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly r2: R2Service,
  ) {}

  // Catalog routes must precede the ':id' routes — Nest matches in
  // declaration order and would otherwise resolve 'catalog' as an id.

  @Get('catalog')
  findCatalog(@Request() req) {
    return this.estimatesService.findCatalog(req.user.userId);
  }

  @Post('catalog')
  createCatalogItem(@Body() dto: CreateCatalogItemDto, @Request() req) {
    return this.estimatesService.createCatalogItem(dto, req.user.userId);
  }

  @Patch('catalog/:id')
  updateCatalogItem(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
    @Request() req,
  ) {
    return this.estimatesService.updateCatalogItem(id, dto, req.user.userId);
  }

  @Delete('catalog/:id')
  removeCatalogItem(@Param('id') id: string, @Request() req) {
    return this.estimatesService.removeCatalogItem(id, req.user.userId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateEstimateDto,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }
    // Verify real PDF bytes, not just the client-supplied mimetype.
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('File is not a valid PDF');
    }

    let data: unknown;
    try {
      data = JSON.parse(dto.data);
    } catch {
      throw new BadRequestException('data must be valid JSON');
    }

    if (dto.patientId) {
      await this.estimatesService.assertPatientOwnership(
        dto.patientId,
        req.user.userId,
      );
    }

    const key = `estimates/${req.user.userId}/${randomUUID()}.pdf`;
    await this.r2.putObject(key, file.buffer, 'application/pdf');

    try {
      return await this.estimatesService.create({
        patientName: dto.patientName,
        patientId: dto.patientId || null,
        totalClp: dto.totalClp ?? null,
        pdfKey: key,
        data: data as object,
        userId: req.user.userId,
      });
    } catch (e) {
      // DB write failed after upload — don't leave an orphaned object.
      await this.r2.deleteObject(key).catch(() => undefined);
      throw e;
    }
  }

  @Get()
  findAll(@Request() req) {
    return this.estimatesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.estimatesService.findOne(id, req.user.userId);
  }

  @Get(':id/download')
  getDownloadUrl(@Param('id') id: string, @Request() req) {
    return this.estimatesService.getDownloadUrl(id, req.user.userId);
  }

  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEstimateDto,
    @Request() req,
  ) {
    return this.estimatesService.updateStatus(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.estimatesService.remove(id, req.user.userId);
  }
}

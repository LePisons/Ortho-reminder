import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PresentationsService } from './presentations.service';
import { CreatePresentationDto } from './dto/create-presentation.dto';
import { UpdatePresentationDto } from './dto/update-presentation.dto';
import { detectImageContentType } from '../storage/image-validation';

// Slide images are screen-resolution, not archival scans; 20 MB matches the
// patient-images cap.
const MAX_ASSET_BYTES = 20 * 1024 * 1024;

@Controller('presentations')
export class PresentationsController {
  constructor(private readonly presentations: PresentationsService) {}

  @Post()
  create(@Body() dto: CreatePresentationDto, @Request() req) {
    return this.presentations.create(dto, req.user.userId);
  }

  @Get()
  findAll(@Query('patientId') patientId: string | undefined, @Request() req) {
    return this.presentations.findAll(req.user.userId, patientId);
  }

  @Post('assets')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ASSET_BYTES },
    }),
  )
  async uploadAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { presentationId?: string },
    @Request() req,
  ) {
    if (!file) throw new BadRequestException('File is required');
    // Verify real image bytes rather than trusting the client's Content-Type.
    const contentType = detectImageContentType(file.buffer);
    if (!contentType) {
      throw new BadRequestException('Unsupported or invalid image file');
    }
    return this.presentations.createAsset(
      req.user.userId,
      file,
      contentType,
      body.presentationId || undefined,
    );
  }

  /**
   * Streams asset bytes through the API. Deliberately not a signed R2 URL:
   * those expire mid-consultation and taint the canvas used for PDF export.
   * Declared before `:id` so the literal `assets` segment wins the match.
   */
  @Get('assets/:id/file')
  async streamAsset(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const asset = await this.presentations.findAsset(id, req.user.userId);
    const object = await this.presentations.streamAsset(asset.key);
    res.setHeader('Content-Type', asset.contentType);
    if (object.ContentLength) {
      res.setHeader('Content-Length', String(object.ContentLength));
    }
    // Keys are immutable, so slides can be revisited without re-downloading.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    (object.Body as Readable).pipe(res);
  }

  @Delete('assets/:id')
  removeAsset(@Param('id') id: string, @Request() req) {
    return this.presentations.removeAsset(id, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.presentations.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePresentationDto,
    @Request() req,
  ) {
    return this.presentations.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.presentations.remove(id, req.user.userId);
  }
}

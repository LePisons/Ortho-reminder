import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { PatientImagesService } from './patient-images.service';
import { CreatePatientImageDto } from './dto/create-patient-image.dto';
import { UpdatePatientImageDto } from './dto/update-patient-image.dto';
import { R2Service } from '../storage/r2.service';
import {
  detectImageContentType,
  extensionForContentType,
} from '../storage/image-validation';

@Controller('patient-images')
export class PatientImagesController {
  constructor(
    private readonly patientImagesService: PatientImagesService,
    private readonly r2: R2Service,
  ) {}

  @Post()
  create(@Body() createPatientImageDto: CreatePatientImageDto, @Request() req) {
    return this.patientImagesService.create(createPatientImageDto, req.user.userId);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\//)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { patientId: string; type: string; category?: string; date?: string; description?: string },
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!body.patientId) {
      throw new BadRequestException('patientId is required');
    }

    // Verify real image bytes, not just the client-supplied mimetype.
    const contentType = detectImageContentType(file.buffer);
    if (!contentType) {
      throw new BadRequestException('Unsupported or invalid image file');
    }

    const key = `patient-images/${body.patientId}/${randomUUID()}.${extensionForContentType(contentType)}`;
    await this.r2.putObject(key, file.buffer, contentType);

    try {
      return await this.patientImagesService.create(
        {
          url: key, // store the opaque R2 key; signed URLs are generated on read
          type: body.type as 'PHOTO' | 'XRAY',
          patientId: body.patientId,
          category: body.category,
          date: body.date,
          description: body.description,
        },
        req.user.userId,
      );
    } catch (e) {
      // Ownership/validation failed after upload — don't leave an orphaned object.
      await this.r2.deleteObject(key).catch(() => undefined);
      throw e;
    }
  }

  @Get()
  findAll(@Query('patientId') patientId: string, @Request() req) {
    return this.patientImagesService.findAll(patientId, req.user.userId);
  }

  /**
   * Streams the image bytes through the API instead of handing out a signed R2
   * URL. Presentations need this for two reasons signed URLs can't satisfy:
   * they expire after 15 minutes (a deck open through a consultation would go
   * blank), and being cross-origin they taint the canvas, which breaks the
   * jsPDF export. Same-origin through the Next `/api/*` rewrite fixes both.
   * The photo grid keeps using signed URLs.
   */
  @Get(':id/file')
  async streamFile(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const image = await this.patientImagesService.findOneRaw(id, req.user.userId);
    if (image.isLegacy) {
      // Pre-R2 rows stored an absolute URL; there is no object to stream.
      return res.redirect(image.url);
    }

    const object = await this.r2.getObject(image.url);
    res.setHeader('Content-Type', object.ContentType || 'image/jpeg');
    if (object.ContentLength) {
      res.setHeader('Content-Length', String(object.ContentLength));
    }
    // Keys are immutable (a replaced image gets a new UUID key), so private
    // caching is safe and spares re-downloads while flipping through slides.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    (object.Body as Readable).pipe(res);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.patientImagesService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePatientImageDto: UpdatePatientImageDto, @Request() req) {
    return this.patientImagesService.update(id, updatePatientImageDto, req.user.userId);
  }

  @Delete('session')
  removeSession(
    @Query('patientId') patientId: string,
    @Query('date') date: string,
    @Request() req,
  ) {
    if (!patientId || !date) {
      throw new BadRequestException('Patient ID and date are required');
    }
    return this.patientImagesService.removeSession(patientId, date, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.patientImagesService.remove(id, req.user.userId);
  }
}

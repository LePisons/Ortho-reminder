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
} from '@nestjs/common';
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

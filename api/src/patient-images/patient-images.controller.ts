import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { PatientImagesService } from './patient-images.service';
import { CreatePatientImageDto } from './dto/create-patient-image.dto';
import { UpdatePatientImageDto } from './dto/update-patient-image.dto';

@Controller('patient-images')
export class PatientImagesController {
  constructor(private readonly patientImagesService: PatientImagesService) {}

  @Post()
  create(@Body() createPatientImageDto: CreatePatientImageDto) {
    return this.patientImagesService.create(createPatientImageDto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'patient-images'),
        filename: (_req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
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
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const url = `${apiUrl}/uploads/patient-images/${file.filename}`;

    return this.patientImagesService.create({
      url,
      type: body.type as 'PHOTO' | 'XRAY',
      patientId: body.patientId,
      category: body.category,
      date: body.date,
      description: body.description,
    });
  }

  @Get()
  findAll(@Query('patientId') patientId: string) {
    return this.patientImagesService.findAll(patientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientImagesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePatientImageDto: UpdatePatientImageDto) {
    return this.patientImagesService.update(id, updatePatientImageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.patientImagesService.remove(id);
  }
}

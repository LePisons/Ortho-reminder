import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';

import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { R2Service } from '../storage/r2.service';
import {
  detectImageContentType,
  extensionForContentType,
} from '../storage/image-validation';

@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly r2: R2Service,
  ) {}

  @Get('stats') // This creates the GET /patients/stats route
  getStats(@Request() req) {
    return this.patientsService.getStats(req.user.userId);
  }

  @Post()
  create(@Body() createPatientDto: CreatePatientDto, @Request() req) {
    return this.patientsService.create(createPatientDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('check-duplicates')
  checkDuplicates(
    @Body() body: { rut?: string; email?: string; phone?: string; excludePatientId?: string },
    @Request() req
  ) {
    return this.patientsService.checkDuplicates(body.rut, body.email, body.phone, req.user.userId, body.excludePatientId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\//)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit for avatars
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const contentType = detectImageContentType(file.buffer);
    if (!contentType) {
      throw new BadRequestException('Unsupported or invalid image file');
    }

    const key = `avatars/${id}/${randomUUID()}.${extensionForContentType(contentType)}`;
    await this.r2.putObject(key, file.buffer, contentType);

    return this.patientsService.uploadAvatar(id, key, req.user.userId);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Request() req,
  ) {
    return this.patientsService.findAll(page, limit, req.user.userId);
  }

  @Get('upcoming')
  findUpcomingChanges(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Request() req,
  ) {
    return this.patientsService.findUpcomingChanges(page, limit, req.user.userId);
  }

  @Get('pipeline')
  getPipeline(@Request() req) {
    return this.patientsService.getPipeline(req.user.userId);
  }

  @Get('search')
  searchPatients(@Query('q') q: string, @Request() req) {
    return this.patientsService.searchPatients(q || '', req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.patientsService.findOne(id, req.user.userId);
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @Request() req) {
    return this.patientsService.getMessages(id, req.user.userId);
  }

  @Patch(':id/messages/read')
  markMessagesRead(@Param('id') id: string, @Request() req) {
    return this.patientsService.markMessagesRead(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePatientDto: UpdatePatientDto, @Request() req) {
    return this.patientsService.update(id, updatePatientDto, req.user.userId);
  }

  @Patch(':id/adjust-aligner')
  adjustAligner(
    @Param('id') id: string,
    @Body() body: { alignerNumber: number },
    @Request() req,
  ) {
    return this.patientsService.adjustAligner(id, body.alignerNumber, req.user.userId);
  }

  @Patch(':id/last-appointment')
  setLastAppointment(
    @Param('id') id: string,
    @Body() body: { date: string },
    @Request() req,
  ) {
    return this.patientsService.setLastAppointment(id, body.date, req.user.userId);
  }

  @Post(':id/start-tracking')
  startTracking(@Param('id') id: string, @Request() req) {
    return this.patientsService.startTracking(id, req.user.userId);
  }

  @Post(':id/start-treatment')
  startTreatment(
    @Param('id') id: string,
    @Body()
    body: {
      startingAligner: number;
      startDate: string;
      wearDaysPerAligner?: number;
      totalAligners?: number;
    },
    @Request() req,
  ) {
    return this.patientsService.startTreatment(
      id,
      body.startingAligner,
      body.startDate,
      req.user.userId,
      body.wearDaysPerAligner,
      body.totalAligners,
    );
  }

  @Patch(':id/pipeline-override')
  setPipelineOverride(
    @Param('id') id: string,
    @Body() body: { stage: string | null },
    @Request() req,
  ) {
    return this.patientsService.setPipelineOverride(id, body.stage ?? null, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.patientsService.remove(id, req.user.userId);
  }
}

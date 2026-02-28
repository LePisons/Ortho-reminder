import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AlignerBatchesService } from './aligner-batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('aligner-batches')
@UseGuards(JwtAuthGuard)
export class AlignerBatchesController {
  constructor(private readonly batchesService: AlignerBatchesService) {}

  @Post()
  create(@Body() createBatchDto: CreateBatchDto, @Request() req) {
    return this.batchesService.create(createBatchDto, req.user.userId);
  }

  @Get('patient/:patientId')
  findAllForPatient(@Param('patientId') patientId: string, @Request() req) {
    return this.batchesService.findAllForPatient(patientId, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.batchesService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateBatchDto: UpdateBatchDto,
    @Request() req,
  ) {
    return this.batchesService.update(id, updateBatchDto, req.user.userId);
  }

  // Explicit Action Endpoints

  @Post(':id/send-order')
  sendOrder(
    @Param('id') id: string,
    @Body('expectedDeliveryDate') expectedDeliveryDate: string,
    @Request() req,
  ) {
    return this.batchesService.sendOrder(
      id,
      new Date(expectedDeliveryDate),
      req.user.userId,
    );
  }

  @Post(':id/generate-upload-url')
  generateUploadUrl(@Param('id') id: string, @Request() req) {
    return this.batchesService.generateUploadUrl(id, req.user.userId);
  }

  @Post(':id/confirm-upload')
  confirmFilesUploaded(
    @Param('id') id: string,
    @Body('fileUrl') fileUrl: string,
    @Body('key') key: string,
    @Request() req,
  ) {
    return this.batchesService.confirmFilesUploaded(id, fileUrl, key, req.user.userId);
  }

  @Post(':id/mark-in-production')
  markInProduction(@Param('id') id: string, @Request() req) {
    return this.batchesService.markInProduction(id, req.user.userId);
  }

  @Post(':id/mark-delivered')
  markDeliveredToClinic(
    @Param('id') id: string,
    @Body('actualDeliveryDate') actualDeliveryDate: string,
    @Request() req,
  ) {
    return this.batchesService.markDeliveredToClinic(
      id,
      new Date(actualDeliveryDate),
      req.user.userId,
    );
  }

  @Post(':id/hand-to-patient')
  handToPatient(@Param('id') id: string, @Request() req) {
    return this.batchesService.handToPatient(id, req.user.userId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Request() req) {
    return this.batchesService.cancel(id, req.user.userId);
  }
}

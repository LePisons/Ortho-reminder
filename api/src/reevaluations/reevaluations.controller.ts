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
import { ReevaluationsService } from './reevaluations.service';
import { CreateReevaluationDto } from './dto/create-reevaluation.dto';
import { UpdateReevaluationDto, ScanUrlDto } from './dto/update-reevaluation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reevaluations')
@UseGuards(JwtAuthGuard)
export class ReevaluationsController {
  constructor(private readonly reevalsService: ReevaluationsService) {}

  @Post()
  create(@Body() createDto: CreateReevaluationDto, @Request() req) {
    return this.reevalsService.create(createDto, req.user.userId);
  }

  @Get('patient/:patientId')
  findAllForPatient(@Param('patientId') patientId: string, @Request() req) {
    return this.reevalsService.findAllForPatient(patientId, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.reevalsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateReevaluationDto,
    @Request() req,
  ) {
    return this.reevalsService.update(id, updateDto, req.user.userId);
  }

  @Post(':id/upload-url')
  generateUploadUrl(@Param('id') id: string, @Request() req) {
    return this.reevalsService.generateUploadUrl(id, req.user.userId);
  }

  @Patch(':id/scan-url')
  confirmScanUploaded(
    @Param('id') id: string,
    @Body() scanUrlDto: ScanUrlDto,
    @Request() req,
  ) {
    return this.reevalsService.confirmScanUploaded(id, scanUrlDto, req.user.userId);
  }

  @Post(':id/approve')
  approveReevaluation(@Param('id') id: string, @Request() req) {
    return this.reevalsService.approveReevaluation(id, req.user.userId);
  }
}

import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
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

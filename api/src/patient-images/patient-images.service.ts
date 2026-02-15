import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientImageDto } from './dto/create-patient-image.dto';
import { UpdatePatientImageDto } from './dto/update-patient-image.dto';

@Injectable()
export class PatientImagesService {
  constructor(private prisma: PrismaService) {}

  create(createPatientImageDto: CreatePatientImageDto) {
    return this.prisma.patientImage.create({
      data: createPatientImageDto,
    });
  }

  findAll(patientId: string) {
    return this.prisma.patientImage.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.patientImage.findUnique({
      where: { id },
    });
  }

  update(id: string, updatePatientImageDto: UpdatePatientImageDto) {
    return this.prisma.patientImage.update({
      where: { id },
      data: updatePatientImageDto,
    });
  }

  remove(id: string) {
    return this.prisma.patientImage.delete({
      where: { id },
    });
  }
}

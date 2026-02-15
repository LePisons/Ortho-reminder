import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClinicalRecordDto } from './dto/create-clinical-record.dto';
import { UpdateClinicalRecordDto } from './dto/update-clinical-record.dto';

@Injectable()
export class ClinicalRecordsService {
  constructor(private prisma: PrismaService) {}

  create(createClinicalRecordDto: CreateClinicalRecordDto) {
    return this.prisma.clinicalRecord.create({
      data: createClinicalRecordDto,
    });
  }

  findAll(patientId: string) {
    return this.prisma.clinicalRecord.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.clinicalRecord.findUnique({
      where: { id },
    });
  }

  update(id: string, updateClinicalRecordDto: UpdateClinicalRecordDto) {
    return this.prisma.clinicalRecord.update({
      where: { id },
      data: updateClinicalRecordDto,
    });
  }

  remove(id: string) {
    return this.prisma.clinicalRecord.delete({
      where: { id },
    });
  }
}

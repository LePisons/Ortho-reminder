import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClinicalRecordDto } from './dto/create-clinical-record.dto';
import { UpdateClinicalRecordDto } from './dto/update-clinical-record.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ClinicalRecordsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Verifies the patient exists, is not soft-deleted, and belongs to the user.
  private async assertPatientOwnership(patientId: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || patient.deletedAt) throw new NotFoundException('Patient not found');
    if (patient.userId !== userId) throw new ForbiddenException();
    return patient;
  }

  // Loads a record and verifies the owning patient belongs to the user.
  private async assertRecordOwnership(id: string, userId: string) {
    const record = await this.prisma.clinicalRecord.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!record) throw new NotFoundException('Clinical record not found');
    if (record.patient.userId !== userId) throw new ForbiddenException();
    return record;
  }

  async create(createClinicalRecordDto: CreateClinicalRecordDto, userId: string) {
    await this.assertPatientOwnership(createClinicalRecordDto.patientId, userId);
    const record = await this.prisma.clinicalRecord.create({
      data: createClinicalRecordDto,
    });
    await this.audit.log({
      actorId: userId,
      action: 'CREATE',
      entity: 'ClinicalRecord',
      entityId: record.id,
      metadata: { patientId: record.patientId },
    });
    return record;
  }

  async findAll(patientId: string, userId: string) {
    await this.assertPatientOwnership(patientId, userId);
    return this.prisma.clinicalRecord.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const record = await this.assertRecordOwnership(id, userId);
    return record;
  }

  async update(id: string, updateClinicalRecordDto: UpdateClinicalRecordDto, userId: string) {
    await this.assertRecordOwnership(id, userId);
    const updated = await this.prisma.clinicalRecord.update({
      where: { id },
      data: updateClinicalRecordDto,
    });
    await this.audit.log({
      actorId: userId,
      action: 'UPDATE',
      entity: 'ClinicalRecord',
      entityId: id,
      metadata: { fields: Object.keys(updateClinicalRecordDto) },
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.assertRecordOwnership(id, userId);
    const deleted = await this.prisma.clinicalRecord.delete({ where: { id } });
    await this.audit.log({
      actorId: userId,
      action: 'DELETE',
      entity: 'ClinicalRecord',
      entityId: id,
    });
    return deleted;
  }
}

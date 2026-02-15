import { PartialType } from '@nestjs/mapped-types';
import { CreateClinicalRecordDto } from './create-clinical-record.dto';

export class UpdateClinicalRecordDto extends PartialType(CreateClinicalRecordDto) {}

import { PartialType } from '@nestjs/mapped-types';
import { CreatePatientImageDto } from './create-patient-image.dto';

export class UpdatePatientImageDto extends PartialType(CreatePatientImageDto) {}

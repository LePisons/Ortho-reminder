import { IsEnum } from 'class-validator';
import { EstimateStatus } from '@prisma/client';

export class UpdateEstimateDto {
  @IsEnum(EstimateStatus)
  status: EstimateStatus;
}

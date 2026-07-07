import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProductionStage } from '@prisma/client';

export class UpdateProductionDto {
  @IsOptional()
  @IsEnum(ProductionStage)
  productionStage?: ProductionStage;

  @IsOptional()
  @IsInt()
  @Min(0)
  modelsPrinted?: number;

  @IsOptional()
  @IsString()
  technicianNotes?: string;
}

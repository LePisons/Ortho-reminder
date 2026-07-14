import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateCatalogItemDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  details?: string;

  // CLP; null/omitted means "Consultar" (quote on request)
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCatalogItemDto extends PartialType(CreateCatalogItemDto) {}

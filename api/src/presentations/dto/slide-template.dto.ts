import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSlideTemplateDto {
  @IsString()
  @MaxLength(200)
  title: string;

  /** A single slide, same shape as one entry of `Presentation.slides`. */
  @IsObject()
  slide: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateSlideTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsObject()
  slide?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

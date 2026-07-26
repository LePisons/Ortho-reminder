import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePresentationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /** External cases only; renaming the subject never touches a patient row. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subjectName?: string;

  @IsOptional()
  @IsArray()
  slides?: unknown[];
}

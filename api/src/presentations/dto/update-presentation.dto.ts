import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePresentationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  slides?: unknown[];
}

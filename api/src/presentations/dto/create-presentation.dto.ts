import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePresentationDto {
  @IsString()
  patientId: string;

  @IsString()
  @MaxLength(200)
  title: string;

  /**
   * The deck itself. Shape is owned by the web client
   * (`web/src/lib/api/presentations.api.ts`) and stored opaquely, same as
   * `Estimate.data` — the API only enforces that it is an array.
   */
  @IsOptional()
  @IsArray()
  slides?: unknown[];
}

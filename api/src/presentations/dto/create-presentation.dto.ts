import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePresentationDto {
  /**
   * Omitted for an external case — a deck about someone who isn't a patient.
   * Exactly one of `patientId` / `subjectName` is expected; the service rejects
   * a deck that has neither.
   */
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subjectName?: string;

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

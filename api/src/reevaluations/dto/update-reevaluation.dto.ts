import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateReevaluationDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ScanUrlDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  scanFileUrl: string;
}

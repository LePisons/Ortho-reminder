import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNoteDto {
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  color?: string; // 'yellow', 'blue', 'pink', 'green'

  @IsOptional()
  @IsString()
  patientId?: string;
}

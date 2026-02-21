export class CreateNoteDto {
  content: string;
  color?: string; // 'yellow', 'blue', 'pink', 'green'
  patientId?: string;
}

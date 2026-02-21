import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  create(createNoteDto: CreateNoteDto) {
    return this.prisma.note.create({
      data: createNoteDto,
    });
  }

  findAll(patientId?: string) {
    return this.prisma.note.findMany({
      where: patientId ? { patientId } : { patientId: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, updateNoteDto: UpdateNoteDto) {
    return this.prisma.note.update({
      where: { id },
      data: updateNoteDto,
    });
  }

  remove(id: string) {
    return this.prisma.note.delete({
      where: { id },
    });
  }
}

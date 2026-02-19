import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentStatus } from '@prisma/client';
import { TodoistService } from '../integrations/todoist/todoist.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private todoistService: TodoistService,
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto) {
    const appointment = await this.prisma.appointment.create({
      data: {
        ...createAppointmentDto,
        status: (createAppointmentDto.status as AppointmentStatus) || 'SCHEDULED',
      },
    });

    // Sync to Todoist
    const todoistId = await this.todoistService.createTask(
        appointment.title, 
        appointment.start.toISOString(),
        `Appointment for patient ID: ${appointment.patientId || 'N/A'}`
    );

    if (todoistId) {
        await this.prisma.appointment.update({
            where: { id: appointment.id },
            data: { todoistTaskId: todoistId },
        });
    }

    return appointment;
  }

  findAll(start?: string, end?: string) {
    const where: any = {};
    if (start && end) {
      where.start = {
        gte: new Date(start),
      };
      where.end = {
        lte: new Date(end),
      };
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
          }
        }
      },
      orderBy: {
        start: 'asc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto) {
    const data: any = { ...updateAppointmentDto };
    if (updateAppointmentDto.status) {
        data.status = updateAppointmentDto.status as AppointmentStatus;
    }
    const appointment = await this.prisma.appointment.update({
      where: { id },
      data,
    });

    // Sync to Todoist
    if (appointment.todoistTaskId) {
        await this.todoistService.updateTask(
            appointment.todoistTaskId,
            appointment.title, // Update title if changed
            appointment.start ? appointment.start.toISOString() : undefined
        );
    }

    return appointment;
  }

  async remove(id: string) {
    const appointment = await this.prisma.appointment.delete({
      where: { id },
    });

    // Sync to Todoist
    if (appointment.todoistTaskId) {
        await this.todoistService.deleteTask(appointment.todoistTaskId);
    }

    return appointment;
  }
}

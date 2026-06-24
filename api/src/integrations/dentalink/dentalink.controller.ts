import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ControlSummary, DentalinkService } from './dentalink.service';
import { AddDentalinkPatientDto } from './dto/add-dentalink-patient.dto';

@Controller('dentalink')
export class DentalinkController {
  constructor(private readonly dentalink: DentalinkService) {}

  /**
   * Paginated, searchable list of patient controls. Stats are computed over the
   * full set (not just the current page) so the header strip stays accurate.
   */
  @Get('controles')
  async getControles(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('refresh') refresh?: string,
    @Query('filter') filter?: string,
  ) {
    const data = await this.dentalink.getControles(refresh === 'true');

    const term = (search ?? '').trim().toLowerCase();
    let filtered = term
      ? data.pacientes.filter((p) => p.nombre.toLowerCase().includes(term))
      : data.pacientes;

    // Stat-card filters mirror the same predicates used by buildStats so the
    // counts and the filtered list always agree. Stats themselves stay computed
    // over the full (unfiltered) set below.
    if (filter === 'proximos7') {
      filtered = filtered.filter(
        (p) => p.diasRestantes !== null && p.diasRestantes <= 7,
      );
    } else if (filter === 'sinProximo') {
      filtered = filtered.filter((p) => p.proximoControl === null);
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const start = (pageNum - 1) * size;

    return {
      fechaReporte: data.fechaReporte,
      generatedAt: data.generatedAt,
      stats: this.buildStats(data.pacientes),
      total: filtered.length,
      page: pageNum,
      pageSize: size,
      pacientes: filtered.slice(start, start + size),
      errores: data.errores,
    };
  }

  /** Current editable roster of Dentalink patients. */
  @Get('patients')
  listPatients() {
    return this.dentalink.listPatients();
  }

  /** Add a patient to the roster (name auto-resolved from Dentalink if omitted). */
  @Post('patients')
  addPatient(@Body() dto: AddDentalinkPatientDto) {
    return this.dentalink.addPatient(dto.id, dto.nombre);
  }

  /** Remove a patient from the roster. */
  @Delete('patients/:id')
  async removePatient(@Param('id', ParseIntPipe) id: number) {
    await this.dentalink.removePatient(id);
    return { ok: true };
  }

  @Get('patients/:id/history')
  getPatientHistory(@Param('id', ParseIntPipe) id: number) {
    return this.dentalink.getPatientHistory(id);
  }

  private buildStats(pacientes: ControlSummary[]) {
    const proximos7 = pacientes.filter(
      (p) => p.diasRestantes !== null && p.diasRestantes <= 7,
    ).length;
    const sinProximo = pacientes.filter((p) => p.proximoControl === null).length;
    return {
      total: pacientes.length,
      proximos7,
      sinProximo,
    };
  }
}

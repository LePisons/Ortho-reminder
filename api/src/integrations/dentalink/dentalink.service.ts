import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

const BASE = 'https://api.dentalink.healthatom.com/api/v1';

export interface DentalinkCita {
  id: number;
  fecha?: string;
  hora_inicio?: string;
  estado_cita?: string;
  [k: string]: unknown;
}

/** A clinical evolution note as returned by /pacientes/{id}/evoluciones. */
interface DentalinkEvolucion {
  id: number;
  fecha?: string;
  datos?: string;
  habilitado?: number | boolean;
}

/** Strip HTML tags and collapse whitespace from evolution note text. */
function cleanHtml(s: string | undefined): string {
  return (s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ControlSummary {
  id: number;
  nombre: string;
  proximoControl: DentalinkCita | null;
  diasRestantes: number | null;
  /** Most recent attended appointment, regardless of whether notes were written. */
  ultimoControl: DentalinkCita | null;
  /** Evolution notes of `ultimoControl` (may be null when nothing was written). */
  resumenUltimo: string | null;
  /**
   * Most recent attended appointment that actually has evolution notes written.
   * Often equals `ultimoControl`, but when the latest visits were left blank this
   * "falls back" to the last visit where the clinician did record something.
   */
  ultimoControlConRegistro: DentalinkCita | null;
  /** Evolution notes of `ultimoControlConRegistro` (non-empty by definition). */
  resumenUltimoConRegistro: string | null;
}

export interface ControlError {
  id: number;
  nombre: string;
  error: string;
}

export interface ControlesData {
  fechaReporte: string; // YYYY-MM-DD (local)
  generatedAt: string; // ISO timestamp of the fetch
  pacientes: ControlSummary[];
  errores: ControlError[];
}

/** Local YYYY-MM-DD without UTC drift. */
function toLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

@Injectable()
export class DentalinkService implements OnModuleInit {
  private readonly logger = new Logger(DentalinkService.name);
  private token: string | undefined;
  private patients: { id: number; nombre: string }[] = [];

  // In-memory cache so the page loads instantly and Dentalink isn't hit on
  // every request (the per-patient /citas calls are N+1).
  private cache: ControlesData | null = null;
  private cacheExpiresAt = 0;
  private readonly ttlMs = 60 * 60 * 1000; // 1h
  private inFlight: Promise<ControlesData> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.token = this.configService.get<string>('DENTALINK_TOKEN');

    // Seed the editable roster once from the env var so the existing list of
    // patients persists and becomes manageable from the UI. After that the DB
    // is the single source of truth.
    const envPatients = this.parsePatients(
      this.configService.get<string>('DENTALINK_PATIENT_IDS') ?? '',
    );
    const count = await this.prisma.dentalinkPatient.count();
    if (count === 0 && envPatients.length > 0) {
      await this.prisma.dentalinkPatient.createMany({
        data: envPatients.map((p) => ({ id: p.id, nombre: p.nombre })),
        skipDuplicates: true,
      });
      this.logger.log(
        `Seeded ${envPatients.length} Dentalink patient(s) from env into the database.`,
      );
    }

    this.patients = await this.loadPatients();
    if (this.token) {
      this.logger.log(
        `Dentalink integration initialized. Patients configured: ${this.patients.length}`,
      );
    } else {
      this.logger.warn(
        'Dentalink integration initialized. DENTALINK_TOKEN not set; the Controles page will be empty.',
      );
    }
  }

  /** Load the persisted roster (DB is the source of truth). */
  private async loadPatients(): Promise<{ id: number; nombre: string }[]> {
    const rows = await this.prisma.dentalinkPatient.findMany({
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
  }

  isAvailable(): boolean {
    return !!this.token && this.patients.length > 0;
  }

  /**
   * Config format: entries separated by ";", each "id:Full Name".
   * Example: "1416:Roxana Schilling;1348:Camila Rivas".
   */
  private parsePatients(raw: string): { id: number; nombre: string }[] {
    return raw
      .split(';')
      .map((e) => e.trim())
      .filter(Boolean)
      .map((entry) => {
        const idx = entry.indexOf(':');
        const id = Number(idx === -1 ? entry : entry.slice(0, idx));
        const nombre = idx === -1 ? `Paciente ${id}` : entry.slice(idx + 1).trim();
        return { id, nombre };
      })
      .filter((p) => Number.isFinite(p.id));
  }

  private get headers() {
    return { Authorization: `Token ${this.token}` };
  }

  /** Fetch every page of a Dentalink list endpoint (follows links.next). */
  private async getAll<T = DentalinkCita>(url: string): Promise<T[]> {
    const items: T[] = [];
    let next: string | null = url;
    while (next) {
      const r = await fetch(next, { headers: this.headers });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      const data = await r.json();
      items.push(...((data.data as T[]) ?? []));
      next = (data.links?.next as string | undefined) ?? null;
    }
    return items;
  }

  /** Cached entry point used by the controller. */
  async getControles(force = false): Promise<ControlesData> {
    if (!force && this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }
    // Coalesce concurrent refreshes into a single Dentalink fetch.
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchControles()
      .then((data) => {
        this.cache = data;
        this.cacheExpiresAt = Date.now() + this.ttlMs;
        return data;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private async fetchControles(): Promise<ControlesData> {
    const today = todayMidnight();
    const result: ControlesData = {
      fechaReporte: ymd(today),
      generatedAt: new Date().toISOString(),
      pacientes: [],
      errores: [],
    };

    if (!this.isAvailable()) return result;

    for (const { id, nombre } of this.patients) {
      try {
        const citas = await this.getAll(`${BASE}/pacientes/${id}/citas`);
        let proximo: DentalinkCita | null = null;
        const atendidas: DentalinkCita[] = [];

        for (const c of citas) {
          if (!c.fecha) continue;
          const fdate = toLocalDate(c.fecha);
          if (fdate >= today && c.estado_cita !== 'Anulado') {
            if (proximo === null || fdate < toLocalDate(proximo.fecha!)) proximo = c;
          }
          if (c.estado_cita === 'Atendido') atendidas.push(c);
        }

        // Newest attended visit first.
        atendidas.sort(
          (a, b) => toLocalDate(b.fecha!).getTime() - toLocalDate(a.fecha!).getTime(),
        );

        const ultimo: DentalinkCita | null = atendidas[0] ?? null;

        // Evolution notes are NOT attached to a cita's /detalles (that array is
        // always empty); they live on /pacientes/{id}/evoluciones and are linked
        // to an appointment only by date. Fetch them once and join by `fecha`.
        const evoluciones = await this.fetchEvoluciones(id);

        // All notes recorded on a given appointment date, joined into one string.
        const resumenForDate = (fecha?: string): string | null => {
          if (!fecha) return null;
          const txt = evoluciones
            .filter((e) => e.fecha === fecha)
            .map((e) => e.datos)
            .join(' | ');
          return txt || null;
        };

        const resumenUltimo = ultimo ? resumenForDate(ultimo.fecha) : null;

        // Most recent note overall (evoluciones is sorted newest-first and only
        // contains non-empty notes), used to surface the last visit where the
        // clinician actually wrote something.
        let ultimoConRegistro: DentalinkCita | null = null;
        let resumenUltimoConRegistro: string | null = null;
        const evoLast = evoluciones[0] ?? null;
        if (evoLast) {
          // Prefer enriching with the matching appointment (attended first) so
          // the date/time/estado display correctly; fall back to a date-only stub.
          const citaMatch =
            atendidas.find((c) => c.fecha === evoLast.fecha) ??
            citas.find((c) => c.fecha === evoLast.fecha) ??
            null;
          ultimoConRegistro =
            citaMatch ?? ({ id: -evoLast.id, fecha: evoLast.fecha } as DentalinkCita);
          resumenUltimoConRegistro = resumenForDate(evoLast.fecha);
        }

        let diasRestantes: number | null = null;
        if (proximo) {
          diasRestantes = Math.round(
            (toLocalDate(proximo.fecha!).getTime() - today.getTime()) / 86_400_000,
          );
        }

        result.pacientes.push({
          id,
          nombre,
          proximoControl: proximo,
          diasRestantes,
          ultimoControl: ultimo,
          resumenUltimo,
          ultimoControlConRegistro: ultimoConRegistro,
          resumenUltimoConRegistro,
        });
      } catch (e) {
        result.errores.push({
          id,
          nombre,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Order by urgency: soonest upcoming control first, those without a next
    // control last.
    result.pacientes.sort((a, b) => {
      const da = a.diasRestantes ?? Number.POSITIVE_INFINITY;
      const db = b.diasRestantes ?? Number.POSITIVE_INFINITY;
      return da - db;
    });

    return result;
  }

  /**
   * Fetch a patient's clinical evolution notes (newest-first), cleaned of HTML
   * and excluding empty or disabled entries. These are the real notes shown on
   * the Controles page — the cita /detalles `evoluciones` array is always empty.
   */
  private async fetchEvoluciones(
    patientId: number,
  ): Promise<{ id: number; fecha?: string; datos: string }[]> {
    const raw = await this.getAll<DentalinkEvolucion>(
      `${BASE}/pacientes/${patientId}/evoluciones`,
    );
    return raw
      .filter((e) => e.habilitado !== 0 && e.habilitado !== false)
      .map((e) => ({ id: e.id, fecha: e.fecha, datos: cleanHtml(e.datos) }))
      .filter((e) => e.datos)
      .sort(
        (a, b) =>
          (b.fecha ?? '').localeCompare(a.fecha ?? '') || b.id - a.id,
      );
  }

  /** Full chronological appointment history for one patient (newest first). */
  async getPatientHistory(id: number): Promise<{
    id: number;
    nombre: string;
    citas: DentalinkCita[];
  }> {
    if (!this.token) throw new Error('Dentalink integration is not configured');
    const known = this.patients.find((p) => p.id === id);
    const citas = await this.getAll(`${BASE}/pacientes/${id}/citas`);
    citas.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
    return { id, nombre: known?.nombre ?? `Paciente ${id}`, citas };
  }

  /** Current roster surfaced on the Controles page. */
  listPatients(): { id: number; nombre: string }[] {
    return this.patients;
  }

  /**
   * Add (or update) a patient in the roster. When `nombre` is omitted it is
   * resolved from Dentalink using the ID, so the user only needs the ID.
   */
  async addPatient(
    id: number,
    nombre?: string,
  ): Promise<{ id: number; nombre: string }> {
    if (!this.token) {
      throw new BadRequestException(
        'La integración con Dentalink no está configurada (falta DENTALINK_TOKEN).',
      );
    }
    const resolved = nombre?.trim() || (await this.fetchPatientName(id));
    const saved = await this.prisma.dentalinkPatient.upsert({
      where: { id },
      create: { id, nombre: resolved },
      update: { nombre: resolved },
    });
    this.patients = await this.loadPatients();
    this.invalidateCache(); // surface the new patient on the next load
    return { id: saved.id, nombre: saved.nombre };
  }

  /** Remove a patient from the roster. */
  async removePatient(id: number): Promise<void> {
    await this.prisma.dentalinkPatient.deleteMany({ where: { id } });
    this.patients = await this.loadPatients();
    this.invalidateCache();
  }

  private invalidateCache() {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  /** Resolve a patient's display name from Dentalink by ID. */
  private async fetchPatientName(id: number): Promise<string> {
    const r = await fetch(`${BASE}/pacientes/${id}`, { headers: this.headers });
    if (r.status === 404) {
      throw new NotFoundException(`No existe el paciente ${id} en Dentalink.`);
    }
    if (!r.ok) {
      throw new BadRequestException(
        `Error consultando Dentalink (HTTP ${r.status}).`,
      );
    }
    const json = await r.json();
    const d = (json.data ?? json) as { nombre?: string; apellidos?: string };
    const nombre = [d.nombre, d.apellidos].filter(Boolean).join(' ').trim();
    return nombre || `Paciente ${id}`;
  }

  // Warm/refresh the cache once a day so the first page load of the morning is
  // already fast (mirrors the weekly-report cadence).
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async refreshDaily() {
    if (!this.isAvailable()) return;
    try {
      await this.getControles(true);
      this.logger.log('Dentalink controles cache refreshed (daily cron).');
    } catch (e) {
      this.logger.error(
        `Failed to refresh Dentalink cache: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}

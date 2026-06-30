import {
  BadRequestException,
  ForbiddenException,
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

  // Per-patient caches shared by the Controles report AND the patient profile
  // page, so neither view re-hits Dentalink when the other already fetched the
  // same data. Concurrent requests for one patient are coalesced.
  private summaryCache = new Map<number, { data: ControlSummary; expiresAt: number }>();
  private summaryInFlight = new Map<number, Promise<ControlSummary>>();
  private citasCache = new Map<number, { data: DentalinkCita[]; expiresAt: number }>();

  // Every Dentalink call funnels through one serialized, spaced-out queue so the
  // N+1 roster fetch never bursts past Dentalink's (undocumented) request limit
  // and triggers HTTP 429. 429/5xx responses are retried with backoff below.
  private requestChain: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;
  private minRequestIntervalMs = 300;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.token = this.configService.get<string>('DENTALINK_TOKEN');
    // Minimum spacing between Dentalink requests (ms). Tunable per environment
    // in case the limit ever needs to be approached more or less aggressively.
    const interval = Number(
      this.configService.get<string>('DENTALINK_MIN_REQUEST_MS'),
    );
    if (Number.isFinite(interval) && interval >= 0) {
      this.minRequestIntervalMs = interval;
    }

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Serialized, rate-limited fetch against Dentalink. Requests run one at a time
   * with a minimum spacing between them, and 429/5xx responses are retried with
   * exponential backoff (honoring the Retry-After header). This is the single
   * choke point that keeps the N+1 roster fetch from bursting past Dentalink's
   * request limit. Every Dentalink HTTP call must go through here.
   */
  private dentalinkFetch(url: string): Promise<Response> {
    const run = async (): Promise<Response> => {
      const maxRetries = 4;
      for (let attempt = 0; ; attempt++) {
        const since = Date.now() - this.lastRequestAt;
        if (since < this.minRequestIntervalMs) {
          await this.sleep(this.minRequestIntervalMs - since);
        }
        this.lastRequestAt = Date.now();

        let res: Response;
        try {
          res = await fetch(url, { headers: this.headers });
        } catch (e) {
          if (attempt >= maxRetries) throw e;
          await this.sleep(1000 * 2 ** attempt);
          continue;
        }

        // Success (or a client error worth surfacing) — return as-is.
        if (res.status !== 429 && res.status < 500) return res;
        if (attempt >= maxRetries) return res;

        const retryAfter = Number(res.headers.get('retry-after'));
        const backoff =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 1000 * 2 ** attempt;
        this.logger.warn(
          `Dentalink HTTP ${res.status} on ${url} — retrying in ${backoff}ms ` +
            `(attempt ${attempt + 1}/${maxRetries}).`,
        );
        await this.sleep(backoff);
      }
    };

    // Chain onto the queue so only one Dentalink request is ever in flight.
    const result = this.requestChain.then(run, run);
    this.requestChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Fetch every page of a Dentalink list endpoint (follows links.next). */
  private async getAll<T = DentalinkCita>(url: string): Promise<T[]> {
    const items: T[] = [];
    let next: string | null = url;
    while (next) {
      const r = await this.dentalinkFetch(next);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      const data = await r.json();
      items.push(...((data.data as T[]) ?? []));
      next = (data.links?.next as string | undefined) ?? null;
    }
    return items;
  }

  /**
   * A patient's appointments, cached so the Controles report, the per-patient
   * summary and the history expansion all share a single Dentalink fetch.
   */
  private async getCitas(id: number, force = false): Promise<DentalinkCita[]> {
    const hit = this.citasCache.get(id);
    if (!force && hit && Date.now() < hit.expiresAt) return hit.data;
    const citas = await this.getAll(`${BASE}/pacientes/${id}/citas`);
    this.citasCache.set(id, { data: citas, expiresAt: Date.now() + this.ttlMs });
    return citas;
  }

  /**
   * Build (or reuse) a patient's control summary. Results are cached per patient
   * and shared between the Controles report and the patient profile page, and
   * concurrent requests for the same patient are coalesced into one fetch.
   */
  private async getSummaryCached(
    id: number,
    nombre: string,
    force = false,
  ): Promise<ControlSummary> {
    const hit = this.summaryCache.get(id);
    if (!force && hit && Date.now() < hit.expiresAt) return hit.data;

    const existing = this.summaryInFlight.get(id);
    if (existing) return existing;

    const p = this.buildSummary(id, nombre, force)
      .then((data) => {
        this.summaryCache.set(id, {
          data,
          expiresAt: Date.now() + this.ttlMs,
        });
        return data;
      })
      .finally(() => this.summaryInFlight.delete(id));

    this.summaryInFlight.set(id, p);
    return p;
  }

  /** Cached entry point used by the controller. */
  async getControles(force = false): Promise<ControlesData> {
    if (!force && this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }
    // Coalesce concurrent refreshes into a single Dentalink fetch.
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchControles(force)
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

  private async fetchControles(force = false): Promise<ControlesData> {
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
        result.pacientes.push(await this.getSummaryCached(id, nombre, force));
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
   * Compute the control summary (next/last appointment + evolution notes) for a
   * single Dentalink patient. Shared by the full Controles report and the
   * per-patient lookup used on the patient profile page.
   */
  private async buildSummary(
    id: number,
    nombre: string,
    force = false,
  ): Promise<ControlSummary> {
    const today = todayMidnight();
    const citas = await this.getCitas(id, force);
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

    return {
      id,
      nombre,
      proximoControl: proximo,
      diasRestantes,
      ultimoControl: ultimo,
      resumenUltimo,
      ultimoControlConRegistro: ultimoConRegistro,
      resumenUltimoConRegistro,
    };
  }

  /**
   * Live control summary for a single patient (not roster-cached). Used by the
   * patient profile page to show the last two clinical histories.
   */
  async getPatientSummary(id: number, force = false): Promise<ControlSummary> {
    if (!this.token) {
      throw new BadRequestException(
        'La integración con Dentalink no está configurada (falta DENTALINK_TOKEN).',
      );
    }
    const known = this.patients.find((p) => p.id === id);
    const nombre = known?.nombre ?? (await this.fetchPatientName(id));
    // Shared per-patient cache: when the Controles report already fetched this
    // patient (or vice versa), this returns instantly without hitting Dentalink.
    return this.getSummaryCached(id, nombre, force);
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
    // Reuse the cached appointments (sort a copy so the cache stays untouched).
    const citas = [...(await this.getCitas(id))].sort((a, b) =>
      (b.fecha ?? '').localeCompare(a.fecha ?? ''),
    );
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
    this.forgetPatient(id); // re-resolve this patient's data on the next load
    this.invalidateReport(); // surface the new patient on the next report load
    return { id: saved.id, nombre: saved.nombre };
  }

  /** Remove a patient from the roster. */
  async removePatient(id: number): Promise<void> {
    await this.prisma.dentalinkPatient.deleteMany({ where: { id } });
    this.patients = await this.loadPatients();
    this.forgetPatient(id);
    this.invalidateReport();
  }

  /**
   * Link an internal patient to a Dentalink ID: adds them to the Controles
   * roster and stores the id on the Patient record. Returns the fresh summary.
   */
  async linkPatient(
    patientId: string,
    dentalinkId: number,
    userId: string,
  ): Promise<ControlSummary> {
    await this.assertPatientOwnership(patientId, userId);
    // Upsert into the roster (also resolves the name + invalidates the cache).
    const { nombre } = await this.addPatient(dentalinkId);
    await this.prisma.patient.update({
      where: { id: patientId },
      data: { dentalinkId },
    });
    // Fetch once and warm the shared cache so the patient page is instant.
    return this.getSummaryCached(dentalinkId, nombre, true);
  }

  /** Unlink an internal patient from Dentalink (roster entry is left intact). */
  async unlinkPatient(patientId: string, userId: string): Promise<void> {
    await this.assertPatientOwnership(patientId, userId);
    await this.prisma.patient.update({
      where: { id: patientId },
      data: { dentalinkId: null },
    });
  }

  /** Verify the patient exists and belongs to the requesting user. */
  private async assertPatientOwnership(patientId: string, userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient || patient.deletedAt) {
      throw new NotFoundException('Patient not found');
    }
    if (patient.userId !== userId) {
      throw new ForbiddenException();
    }
    return patient;
  }

  /** Invalidate the assembled report (per-patient caches are left intact). */
  private invalidateReport() {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  /** Drop one patient's cached summary/appointments so they refetch next time. */
  private forgetPatient(id: number) {
    this.summaryCache.delete(id);
    this.citasCache.delete(id);
  }

  /** Resolve a patient's display name from Dentalink by ID. */
  private async fetchPatientName(id: number): Promise<string> {
    const r = await this.dentalinkFetch(`${BASE}/pacientes/${id}`);
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

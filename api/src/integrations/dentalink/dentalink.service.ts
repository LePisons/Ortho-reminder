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

/**
 * The clinics surfaced as tabs on the Controles page. Each is a separate
 * Dentalink account with its own API token, so adding another clinic is purely
 * a matter of adding an entry here and setting its token env var.
 *
 *  - `tokenEnv`: env vars tried in order for the API token (first non-empty wins).
 *  - `patientIdsEnv`: env var used to seed the roster the first time (per clinic).
 */
interface ClinicDef {
  key: string;
  nombre: string;
  tokenEnv: string[];
  patientIdsEnv: string;
}

export const CLINICS: ClinicDef[] = [
  {
    key: 'quiero-frenillos',
    nombre: 'Clínica Quiero Frenillos',
    // Keep the original DENTALINK_TOKEN working as the Quiero Frenillos token.
    tokenEnv: ['DENTALINK_TOKEN_QUIERO_FRENILLOS', 'DENTALINK_TOKEN'],
    patientIdsEnv: 'DENTALINK_PATIENT_IDS',
  },
  {
    key: 'newen',
    nombre: 'Clínica Newen',
    tokenEnv: ['DENTALINK_TOKEN_NEWEN'],
    patientIdsEnv: 'DENTALINK_PATIENT_IDS_NEWEN',
  },
];

export const DEFAULT_CLINIC = CLINICS[0].key;

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

/**
 * All mutable, per-clinic runtime state: the API token, the roster, the
 * assembled-report cache, the per-patient caches, and the serialized rate-limit
 * queue. Each clinic is a distinct Dentalink account, so everything here is kept
 * fully independent — switching tabs to one clinic never touches another's
 * caches or its request budget.
 */
class ClinicState {
  token: string | undefined;
  patients: { id: number; nombre: string }[] = [];

  // Assembled-report cache so the page loads instantly and Dentalink isn't hit
  // on every request (the per-patient /citas calls are N+1).
  cache: ControlesData | null = null;
  cacheExpiresAt = 0;
  inFlight: Promise<ControlesData> | null = null;

  // Per-patient caches shared by the Controles report AND the patient profile
  // page, so neither view re-hits Dentalink when the other already fetched the
  // same data. Concurrent requests for one patient are coalesced.
  summaryCache = new Map<number, { data: ControlSummary; expiresAt: number }>();
  summaryInFlight = new Map<number, Promise<ControlSummary>>();
  citasCache = new Map<number, { data: DentalinkCita[]; expiresAt: number }>();

  // Each clinic gets its own serialized, spaced-out queue so the N+1 roster
  // fetch never bursts past Dentalink's (undocumented) per-account request limit.
  requestChain: Promise<unknown> = Promise.resolve();
  lastRequestAt = 0;

  constructor(
    readonly key: string,
    readonly nombre: string,
  ) {}
}

@Injectable()
export class DentalinkService implements OnModuleInit {
  private readonly logger = new Logger(DentalinkService.name);

  private readonly clinics = new Map<string, ClinicState>();

  private readonly ttlMs = 60 * 60 * 1000; // 1h
  private minRequestIntervalMs = 300;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Minimum spacing between Dentalink requests (ms). Tunable per environment
    // in case the limit ever needs to be approached more or less aggressively.
    const interval = Number(
      this.configService.get<string>('DENTALINK_MIN_REQUEST_MS'),
    );
    if (Number.isFinite(interval) && interval >= 0) {
      this.minRequestIntervalMs = interval;
    }

    for (const def of CLINICS) {
      const state = new ClinicState(def.key, def.nombre);
      state.token = def.tokenEnv
        .map((name) => this.configService.get<string>(name))
        .find((v) => v && v.trim().length > 0)
        ?.trim();

      // Seed this clinic's roster once from its env var so the existing list of
      // patients persists and becomes manageable from the UI. After that the DB
      // is the single source of truth.
      const envPatients = this.parsePatients(
        this.configService.get<string>(def.patientIdsEnv) ?? '',
      );
      const count = await this.prisma.dentalinkPatient.count({
        where: { clinic: def.key },
      });
      if (count === 0 && envPatients.length > 0) {
        await this.prisma.dentalinkPatient.createMany({
          data: envPatients.map((p) => ({
            id: p.id,
            clinic: def.key,
            nombre: p.nombre,
          })),
          skipDuplicates: true,
        });
        this.logger.log(
          `[${def.key}] Seeded ${envPatients.length} Dentalink patient(s) from env.`,
        );
      }

      state.patients = await this.loadPatients(def.key);
      this.clinics.set(def.key, state);

      if (state.token) {
        this.logger.log(
          `[${def.key}] Dentalink initialized. Patients configured: ${state.patients.length}`,
        );
      } else {
        this.logger.warn(
          `[${def.key}] Dentalink initialized but token not set; its Controles tab will be empty.`,
        );
      }
    }
  }

  /** Resolve a clinic's state, falling back to the default clinic. */
  private clinic(key?: string): ClinicState {
    const state = this.clinics.get(key ?? DEFAULT_CLINIC);
    if (!state) {
      throw new BadRequestException(`Clínica desconocida: ${key}`);
    }
    return state;
  }

  /** The clinics available as tabs, with whether each has a token configured. */
  listClinics(): { key: string; nombre: string; available: boolean }[] {
    return CLINICS.map((def) => {
      const state = this.clinics.get(def.key);
      return {
        key: def.key,
        nombre: def.nombre,
        available: !!state?.token,
      };
    });
  }

  /** Load a clinic's persisted roster (DB is the source of truth). */
  private async loadPatients(
    clinicKey: string,
  ): Promise<{ id: number; nombre: string }[]> {
    const rows = await this.prisma.dentalinkPatient.findMany({
      where: { clinic: clinicKey },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
  }

  private isAvailable(state: ClinicState): boolean {
    return !!state.token && state.patients.length > 0;
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

  private headers(state: ClinicState) {
    return { Authorization: `Token ${state.token}` };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Serialized, rate-limited fetch against Dentalink for one clinic. Requests
   * run one at a time per clinic with a minimum spacing between them, and
   * 429/5xx responses are retried with exponential backoff (honoring the
   * Retry-After header). This is the single choke point that keeps the N+1
   * roster fetch from bursting past Dentalink's request limit. Every Dentalink
   * HTTP call must go through here.
   */
  private dentalinkFetch(state: ClinicState, url: string): Promise<Response> {
    const run = async (): Promise<Response> => {
      const maxRetries = 4;
      for (let attempt = 0; ; attempt++) {
        const since = Date.now() - state.lastRequestAt;
        if (since < this.minRequestIntervalMs) {
          await this.sleep(this.minRequestIntervalMs - since);
        }
        state.lastRequestAt = Date.now();

        let res: Response;
        try {
          res = await fetch(url, { headers: this.headers(state) });
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
          `[${state.key}] Dentalink HTTP ${res.status} on ${url} — retrying in ` +
            `${backoff}ms (attempt ${attempt + 1}/${maxRetries}).`,
        );
        await this.sleep(backoff);
      }
    };

    // Chain onto the clinic's queue so only one request per clinic is in flight.
    const result = state.requestChain.then(run, run);
    state.requestChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Fetch every page of a Dentalink list endpoint (follows links.next). */
  private async getAll<T = DentalinkCita>(
    state: ClinicState,
    url: string,
  ): Promise<T[]> {
    const items: T[] = [];
    let next: string | null = url;
    while (next) {
      const r = await this.dentalinkFetch(state, next);
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
  private async getCitas(
    state: ClinicState,
    id: number,
    force = false,
  ): Promise<DentalinkCita[]> {
    const hit = state.citasCache.get(id);
    if (!force && hit && Date.now() < hit.expiresAt) return hit.data;
    const citas = await this.getAll(state, `${BASE}/pacientes/${id}/citas`);
    state.citasCache.set(id, { data: citas, expiresAt: Date.now() + this.ttlMs });
    return citas;
  }

  /**
   * Build (or reuse) a patient's control summary. Results are cached per patient
   * and shared between the Controles report and the patient profile page, and
   * concurrent requests for the same patient are coalesced into one fetch.
   */
  private async getSummaryCached(
    state: ClinicState,
    id: number,
    nombre: string,
    force = false,
  ): Promise<ControlSummary> {
    const hit = state.summaryCache.get(id);
    if (!force && hit && Date.now() < hit.expiresAt) return hit.data;

    const existing = state.summaryInFlight.get(id);
    if (existing) return existing;

    const p = this.buildSummary(state, id, nombre, force)
      .then((data) => {
        state.summaryCache.set(id, {
          data,
          expiresAt: Date.now() + this.ttlMs,
        });
        return data;
      })
      .finally(() => state.summaryInFlight.delete(id));

    state.summaryInFlight.set(id, p);
    return p;
  }

  /** Cached entry point used by the controller. */
  async getControles(clinicKey?: string, force = false): Promise<ControlesData> {
    const state = this.clinic(clinicKey);
    if (!force && state.cache && Date.now() < state.cacheExpiresAt) {
      return state.cache;
    }
    // Coalesce concurrent refreshes into a single Dentalink fetch.
    if (state.inFlight) return state.inFlight;

    state.inFlight = this.fetchControles(state, force)
      .then((data) => {
        state.cache = data;
        state.cacheExpiresAt = Date.now() + this.ttlMs;
        return data;
      })
      .finally(() => {
        state.inFlight = null;
      });

    return state.inFlight;
  }

  private async fetchControles(
    state: ClinicState,
    force = false,
  ): Promise<ControlesData> {
    const today = todayMidnight();
    const result: ControlesData = {
      fechaReporte: ymd(today),
      generatedAt: new Date().toISOString(),
      pacientes: [],
      errores: [],
    };

    if (!this.isAvailable(state)) return result;

    for (const { id, nombre } of state.patients) {
      try {
        result.pacientes.push(await this.getSummaryCached(state, id, nombre, force));
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
    state: ClinicState,
    id: number,
    nombre: string,
    force = false,
  ): Promise<ControlSummary> {
    const today = todayMidnight();
    const citas = await this.getCitas(state, id, force);
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
    const evoluciones = await this.fetchEvoluciones(state, id);

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
   * Live control summary for a single patient (roster-cached per clinic). Used
   * by the patient profile page to show the last two clinical histories.
   */
  async getPatientSummary(
    id: number,
    clinicKey?: string,
    force = false,
  ): Promise<ControlSummary> {
    const state = this.clinic(clinicKey);
    if (!state.token) {
      throw new BadRequestException(
        `La integración con Dentalink no está configurada para ${state.nombre}.`,
      );
    }
    const known = state.patients.find((p) => p.id === id);
    const nombre = known?.nombre ?? (await this.fetchPatientName(state, id));
    // Shared per-patient cache: when the Controles report already fetched this
    // patient (or vice versa), this returns instantly without hitting Dentalink.
    return this.getSummaryCached(state, id, nombre, force);
  }

  /**
   * Fetch a patient's clinical evolution notes (newest-first), cleaned of HTML
   * and excluding empty or disabled entries. These are the real notes shown on
   * the Controles page — the cita /detalles `evoluciones` array is always empty.
   */
  private async fetchEvoluciones(
    state: ClinicState,
    patientId: number,
  ): Promise<{ id: number; fecha?: string; datos: string }[]> {
    const raw = await this.getAll<DentalinkEvolucion>(
      state,
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
  async getPatientHistory(
    id: number,
    clinicKey?: string,
  ): Promise<{
    id: number;
    nombre: string;
    citas: DentalinkCita[];
  }> {
    const state = this.clinic(clinicKey);
    if (!state.token) {
      throw new BadRequestException(
        `La integración con Dentalink no está configurada para ${state.nombre}.`,
      );
    }
    const known = state.patients.find((p) => p.id === id);
    // Reuse the cached appointments (sort a copy so the cache stays untouched).
    const citas = [...(await this.getCitas(state, id))].sort((a, b) =>
      (b.fecha ?? '').localeCompare(a.fecha ?? ''),
    );
    return { id, nombre: known?.nombre ?? `Paciente ${id}`, citas };
  }

  /** Current roster surfaced on the Controles page for one clinic. */
  listPatients(clinicKey?: string): { id: number; nombre: string }[] {
    return this.clinic(clinicKey).patients;
  }

  /**
   * Add (or update) a patient in a clinic's roster. When `nombre` is omitted it
   * is resolved from Dentalink using the ID, so the user only needs the ID.
   */
  async addPatient(
    id: number,
    clinicKey?: string,
    nombre?: string,
  ): Promise<ControlSummary> {
    const state = this.clinic(clinicKey);
    if (!state.token) {
      throw new BadRequestException(
        `La integración con Dentalink no está configurada para ${state.nombre}.`,
      );
    }
    const resolved = nombre?.trim() || (await this.fetchPatientName(state, id));
    const saved = await this.prisma.dentalinkPatient.upsert({
      where: { clinic_id: { clinic: state.key, id } },
      create: { id, clinic: state.key, nombre: resolved },
      update: { nombre: resolved },
    });
    state.patients = await this.loadPatients(state.key);
    this.forgetPatient(state, id); // drop any stale cached data for this patient
    this.invalidateReport(state); // surface the new patient on the next report load
    // Build + cache this patient's summary now so it appears instantly in the
    // Controles list and on the patient page without another Dentalink fetch.
    return this.getSummaryCached(state, saved.id, saved.nombre, true);
  }

  /** Remove a patient from a clinic's roster. */
  async removePatient(id: number, clinicKey?: string): Promise<void> {
    const state = this.clinic(clinicKey);
    await this.prisma.dentalinkPatient.deleteMany({
      where: { clinic: state.key, id },
    });
    state.patients = await this.loadPatients(state.key);
    this.forgetPatient(state, id);
    this.invalidateReport(state);
  }

  /**
   * Link an internal patient to a Dentalink ID: adds them to the clinic's
   * Controles roster and stores the id + clinic on the Patient record. Returns
   * the fresh summary.
   */
  async linkPatient(
    patientId: string,
    dentalinkId: number,
    userId: string,
    clinicKey?: string,
  ): Promise<ControlSummary> {
    const state = this.clinic(clinicKey);
    await this.assertPatientOwnership(patientId, userId);
    // Upsert into the roster — this also resolves the name, invalidates the
    // report cache, and warms (returns) the patient's summary in one go.
    const summary = await this.addPatient(dentalinkId, state.key);
    await this.prisma.patient.update({
      where: { id: patientId },
      data: { dentalinkId, dentalinkClinic: state.key },
    });
    return summary;
  }

  /** Unlink an internal patient from Dentalink (roster entry is left intact). */
  async unlinkPatient(patientId: string, userId: string): Promise<void> {
    await this.assertPatientOwnership(patientId, userId);
    await this.prisma.patient.update({
      where: { id: patientId },
      data: { dentalinkId: null, dentalinkClinic: null },
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

  /** Invalidate one clinic's assembled report (per-patient caches stay intact). */
  private invalidateReport(state: ClinicState) {
    state.cache = null;
    state.cacheExpiresAt = 0;
  }

  /** Drop one patient's cached summary/appointments so they refetch next time. */
  private forgetPatient(state: ClinicState, id: number) {
    state.summaryCache.delete(id);
    state.citasCache.delete(id);
  }

  /** Resolve a patient's display name from Dentalink by ID. */
  private async fetchPatientName(
    state: ClinicState,
    id: number,
  ): Promise<string> {
    const r = await this.dentalinkFetch(state, `${BASE}/pacientes/${id}`);
    if (r.status === 404) {
      throw new NotFoundException(
        `No existe el paciente ${id} en Dentalink (${state.nombre}).`,
      );
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

  // Warm/refresh every clinic's cache once a day so the first page load of the
  // morning is already fast (mirrors the weekly-report cadence).
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async refreshDaily() {
    for (const state of this.clinics.values()) {
      if (!this.isAvailable(state)) continue;
      try {
        await this.getControles(state.key, true);
        this.logger.log(`[${state.key}] Dentalink controles cache refreshed (daily cron).`);
      } catch (e) {
        this.logger.error(
          `[${state.key}] Failed to refresh Dentalink cache: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
    }
  }
}

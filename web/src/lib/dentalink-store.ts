import {
  Clinic,
  ControlesFilter,
  ControlesResponse,
  ControlSummary,
  DentalinkApi,
} from "@/lib/api/dentalink.api";

/**
 * App-wide client cache for Dentalink data. Module-level, so whichever page
 * fetches first (Controles, Lab, patient profile) warms the cache for every
 * other consumer for the lifetime of the browser tab — no context/provider
 * needed because consumers copy results into their own state.
 *
 * The server keeps its own 1h caches (see api dentalink.service.ts); this
 * layer only removes redundant round-trips and loading spinners between
 * pages. Concurrent callers for the same key share one in-flight promise.
 */

const clinicsState: {
  data: Clinic[] | null;
  inFlight: Promise<Clinic[]> | null;
} = { data: null, inFlight: null };

const controlesCache = new Map<string, ControlesResponse>();
const controlesInFlight = new Map<string, Promise<ControlesResponse>>();

const summaryCache = new Map<string, ControlSummary>();
const summaryInFlight = new Map<string, Promise<ControlSummary>>();

export interface ControlesParams {
  search?: string;
  page?: number;
  pageSize?: number;
  filter?: ControlesFilter;
  clinic?: string;
}

// Key starts with the clinic so invalidateClinic can prefix-match.
const controlesKey = (p: ControlesParams) =>
  `${p.clinic ?? ""}|${p.search ?? ""}|${p.filter ?? ""}|${p.page ?? 1}|${p.pageSize ?? 20}`;

const summaryKey = (id: number, clinic?: string) => `${clinic ?? ""}|${id}`;

export const DentalinkStore = {
  async getClinics(): Promise<Clinic[]> {
    if (clinicsState.data) return clinicsState.data;
    if (!clinicsState.inFlight) {
      clinicsState.inFlight = DentalinkApi.listClinics()
        .then((clinics) => {
          clinicsState.data = clinics;
          return clinics;
        })
        .finally(() => {
          clinicsState.inFlight = null;
        });
    }
    return clinicsState.inFlight;
  },

  /** Cached controles list. `refresh` bypasses BOTH this and the server cache. */
  async getControles(
    params: ControlesParams,
    opts?: { refresh?: boolean },
  ): Promise<ControlesResponse> {
    const key = controlesKey(params);
    if (!opts?.refresh) {
      const cached = controlesCache.get(key);
      if (cached) return cached;
      const pending = controlesInFlight.get(key);
      if (pending) return pending;
    }
    const promise = DentalinkApi.getControles({
      ...params,
      refresh: opts?.refresh,
    })
      .then((res) => {
        controlesCache.set(key, res);
        return res;
      })
      .finally(() => {
        controlesInFlight.delete(key);
      });
    controlesInFlight.set(key, promise);
    return promise;
  },

  /** Peek without fetching (lets pages render instantly when warm). */
  peekControles(params: ControlesParams): ControlesResponse | undefined {
    return controlesCache.get(controlesKey(params));
  },

  async getPatientSummary(
    id: number,
    clinic?: string,
    opts?: { refresh?: boolean },
  ): Promise<ControlSummary> {
    const key = summaryKey(id, clinic);
    if (!opts?.refresh) {
      const cached = summaryCache.get(key);
      if (cached) return cached;
      const pending = summaryInFlight.get(key);
      if (pending) return pending;
    }
    const promise = DentalinkApi.getPatientSummary(id, clinic)
      .then((res) => {
        summaryCache.set(key, res);
        return res;
      })
      .finally(() => {
        summaryInFlight.delete(key);
      });
    summaryInFlight.set(key, promise);
    return promise;
  },

  /**
   * Drop everything cached for one clinic (all controles pages/filters and
   * patient summaries). Call after roster changes or an explicit refresh.
   */
  invalidateClinic(clinicKey?: string) {
    const prefix = `${clinicKey ?? ""}|`;
    for (const key of controlesCache.keys()) {
      if (key.startsWith(prefix)) controlesCache.delete(key);
    }
    for (const key of summaryCache.keys()) {
      if (key.startsWith(prefix)) summaryCache.delete(key);
    }
  },
};

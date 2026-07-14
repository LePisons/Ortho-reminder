import { API_URL } from "@/lib/utils";

export type EstimateStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export interface CatalogItem {
  id: string;
  name: string;
  details: string | null;
  price: number | null; // CLP; null = "Consultar"
  sortOrder: number;
}

export interface EstimateLineItem {
  name: string;
  details?: string;
  price: number | "Consultar";
  catalogItemId?: string;
}

// Full builder snapshot stored with each estimate so it can be duplicated
// and re-edited later. Keep backwards-compatible: bump `version` on breaking
// shape changes.
export interface EstimateData {
  version: 1;
  date: string; // ISO date shown on the PDF
  patient: { name: string; rut?: string; phone?: string; email?: string };
  treatment?: { durationMonths?: string; alignerCount?: string; controlsCount?: string };
  items: EstimateLineItem[];
  discount?: { label: string; amount: number };
  cashDiscountPct: number; // default 5
  installmentMonths: number[]; // e.g. [3, 6, 12]; empty = no installments shown
  validityDays: number;
  notes?: string;
}

export interface EstimateSummary {
  id: string;
  patientName: string;
  patientId: string | null;
  status: EstimateStatus;
  totalClp: number | null;
  createdAt: string;
}

export interface Estimate extends EstimateSummary {
  data: EstimateData;
  updatedAt: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export const EstimatesApi = {
  list: async (): Promise<EstimateSummary[]> =>
    json(await fetch(`${API_URL}/estimates`, { credentials: "include" })),

  get: async (id: string): Promise<Estimate> =>
    json(await fetch(`${API_URL}/estimates/${id}`, { credentials: "include" })),

  create: async (args: {
    pdf: Blob;
    fileName: string;
    patientName: string;
    patientId?: string | null;
    totalClp?: number | null;
    data: EstimateData;
  }): Promise<EstimateSummary> => {
    const form = new FormData();
    form.append("file", args.pdf, args.fileName);
    form.append("patientName", args.patientName);
    if (args.patientId) form.append("patientId", args.patientId);
    if (args.totalClp != null) form.append("totalClp", String(args.totalClp));
    form.append("data", JSON.stringify(args.data));
    return json(
      await fetch(`${API_URL}/estimates`, {
        method: "POST",
        credentials: "include",
        body: form,
      }),
    );
  },

  updateStatus: async (id: string, status: EstimateStatus): Promise<EstimateSummary> =>
    json(
      await fetch(`${API_URL}/estimates/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    ),

  remove: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/estimates/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Failed to delete estimate (${res.status})`);
  },

  getDownloadUrl: async (id: string): Promise<string> => {
    const { url } = await json<{ url: string }>(
      await fetch(`${API_URL}/estimates/${id}/download`, { credentials: "include" }),
    );
    return url;
  },

  // ---- Service catalog ----

  catalogList: async (): Promise<CatalogItem[]> =>
    json(await fetch(`${API_URL}/estimates/catalog`, { credentials: "include" })),

  catalogCreate: async (item: {
    name: string;
    details?: string;
    price?: number | null;
    sortOrder?: number;
  }): Promise<CatalogItem> =>
    json(
      await fetch(`${API_URL}/estimates/catalog`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      }),
    ),

  catalogUpdate: async (
    id: string,
    item: { name?: string; details?: string; price?: number | null; sortOrder?: number },
  ): Promise<CatalogItem> =>
    json(
      await fetch(`${API_URL}/estimates/catalog/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      }),
    ),

  catalogDelete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/estimates/catalog/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Failed to delete catalog item (${res.status})`);
  },
};

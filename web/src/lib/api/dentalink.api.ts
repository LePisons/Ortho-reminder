import { API_URL } from "@/lib/utils";

export interface DentalinkCita {
  id: number;
  fecha?: string;
  hora_inicio?: string;
  estado_cita?: string;
}

export interface ControlSummary {
  id: number;
  nombre: string;
  proximoControl: DentalinkCita | null;
  diasRestantes: number | null;
  ultimoControl: DentalinkCita | null;
  resumenUltimo: string | null;
  ultimoControlConRegistro: DentalinkCita | null;
  resumenUltimoConRegistro: string | null;
}

export interface ControlesResponse {
  fechaReporte: string;
  generatedAt: string;
  stats: { total: number; proximos7: number; sinProximo: number };
  total: number;
  page: number;
  pageSize: number;
  pacientes: ControlSummary[];
  errores: { id: number; nombre: string; error: string }[];
}

export type ControlesFilter = "proximos7" | "sinProximo";

export interface RosterPatient {
  id: number;
  nombre: string;
}

export interface PatientHistory {
  id: number;
  nombre: string;
  citas: DentalinkCita[];
}

export const DentalinkApi = {
  getControles: async (params: {
    search?: string;
    page?: number;
    pageSize?: number;
    refresh?: boolean;
    filter?: ControlesFilter;
  }): Promise<ControlesResponse> => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.page) q.set("page", String(params.page));
    if (params.pageSize) q.set("pageSize", String(params.pageSize));
    if (params.refresh) q.set("refresh", "true");
    if (params.filter) q.set("filter", params.filter);
    const res = await fetch(`${API_URL}/dentalink/controles?${q.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch controles");
    return res.json();
  },

  getPatientHistory: async (id: number): Promise<PatientHistory> => {
    const res = await fetch(`${API_URL}/dentalink/patients/${id}/history`);
    if (!res.ok) throw new Error("Failed to fetch patient history");
    return res.json();
  },

  getPatientSummary: async (id: number): Promise<ControlSummary> => {
    const res = await fetch(`${API_URL}/dentalink/patients/${id}/summary`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch patient summary");
    return res.json();
  },

  linkPatient: async (input: {
    patientId: string;
    dentalinkId: number;
  }): Promise<ControlSummary> => {
    const res = await fetch(`${API_URL}/dentalink/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const msg = await res
        .json()
        .then((b) => (Array.isArray(b?.message) ? b.message.join(", ") : b?.message))
        .catch(() => null);
      throw new Error(msg || "No se pudo vincular el paciente");
    }
    return res.json();
  },

  unlinkPatient: async (patientId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/dentalink/link/${patientId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudo desvincular el paciente");
  },

  listPatients: async (): Promise<RosterPatient[]> => {
    const res = await fetch(`${API_URL}/dentalink/patients`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch patients");
    return res.json();
  },

  addPatient: async (input: {
    id: number;
    nombre?: string;
  }): Promise<RosterPatient> => {
    const res = await fetch(`${API_URL}/dentalink/patients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const msg = await res
        .json()
        .then((b) => (Array.isArray(b?.message) ? b.message.join(", ") : b?.message))
        .catch(() => null);
      throw new Error(msg || "No se pudo agregar el paciente");
    }
    return res.json();
  },

  removePatient: async (id: number): Promise<void> => {
    const res = await fetch(`${API_URL}/dentalink/patients/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudo eliminar el paciente");
  },
};

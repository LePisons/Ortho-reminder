import { API_URL } from "@/lib/utils";

export async function referralRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_URL}/referrals${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(" · ")
        : data.message ||
          "No se pudo completar la operación. Inténtalo nuevamente.",
    );
  }
  return response.json();
}

export const referralStatus: Record<string, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Por revisar",
  NEEDS_INFO: "Faltan antecedentes",
  ACCEPTED: "Aceptada",
};
export const fileKinds: Record<string, string> = {
  STL_UPPER: "STL superior",
  STL_LOWER: "STL inferior",
  PHOTO: "Fotografía original",
  XRAY: "Radiografía (imagen)",
};
export interface ReferralSummary {
  id: string;
  fullName: string;
  status: string;
  revokedAt: string | null;
  updatedAt: string;
  referrer: { id: string; name: string; email: string };
  _count: { files: number; comments: number };
}
export interface Colleague {
  id: string;
  name: string;
  email: string;
  disabledAt: string | null;
  mustChangePassword: boolean;
}
export interface ReferralInput {
  fullName: string;
  rut: string;
  email: string;
  phone: string;
  reason: string;
  treatment?: TreatmentRequest | null;
}
export const treatmentFields = [
  {
    key: "goals",
    label: "Objetivos del tratamiento",
    hint: "Describe qué quieres corregir y el resultado esperado.",
    max: 2000,
  },
  {
    key: "upperMidline",
    label: "Línea media superior",
    hint: "Mantener o desplazar. Indica dirección, referencia y milímetros si corresponde.",
    max: 1000,
  },
  {
    key: "lowerMidline",
    label: "Línea media inferior",
    hint: "Mantener o desplazar. Indica dirección, referencia y milímetros si corresponde.",
    max: 1000,
  },
  {
    key: "attachments",
    label: "Attachments",
    hint: "Preferencias de ubicación, dientes o zonas a evitar.",
    max: 2000,
  },
  {
    key: "elasticCuts",
    label: "Cortes para elásticos",
    hint: "Indica dientes (notación FDI), lado y ubicación de los cortes.",
    max: 2000,
  },
  {
    key: "buttons",
    label: "Botones y ventanas",
    hint: "Indica dientes, superficie y necesidad de espacio o ventana para el botón.",
    max: 2000,
  },
  {
    key: "ipr",
    label: "Espacios e IPR",
    hint: "Describe indicaciones o restricciones para reducción interproximal y manejo de espacios.",
    max: 2000,
  },
  {
    key: "restrictions",
    label: "Otras indicaciones y limitaciones",
    hint: "Movimientos a evitar, restauraciones, antecedentes u otras consideraciones.",
    max: 2000,
  },
] as const;
export type TreatmentRequest = Partial<
  Record<(typeof treatmentFields)[number]["key"], string>
>;
export const photoViews: Record<string, string> = {
  UNASSIGNED: "Sin clasificar",
  EXTRAORAL_FRONT: "Frontal en reposo",
  EXTRAORAL_SMILE: "Frontal sonriendo",
  EXTRAORAL_PROFILE: "Perfil",
  INTRAORAL_FRONT: "Intraoral frontal",
  INTRAORAL_RIGHT: "Lateral derecha",
  INTRAORAL_LEFT: "Lateral izquierda",
  OCCLUSAL_UPPER: "Oclusal superior",
  OCCLUSAL_LOWER: "Oclusal inferior",
};
export interface ReferralDetail extends ReferralInput {
  sharedProgress?: {
    status: string;
    currentAligner: number;
    totalAligners: number;
  } | null;
  id: string;
  status: string;
  revokedAt: string | null;
  patientId?: string;
  referrer: { id: string; name: string; email: string };
  files: {
    id: string;
    name: string;
    kind: string;
    photoView?: string;
    size: number;
    uploadedBy: string;
    createdAt: string;
  }[];
  comments: {
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
  }[];
  setups: { id: string; title: string; url: string; createdAt: string }[];
}

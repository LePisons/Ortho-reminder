import { API_URL } from "@/lib/utils";

// ─── Slide contract ─────────────────────────────────────────────────────────
//
// A deck is stored opaquely as JSON on `Presentation.slides` (same approach as
// `EstimateData`), so this file is the single source of truth for its shape.
// Keep it backwards-compatible; bump `version` on breaking changes.

/** Every layout, with how many media frames it exposes. */
export const LAYOUT_FRAMES = {
  title: 0,
  text: 0,
  full: 1,
  duo: 2,
  trio: 3,
  quad: 4,
  grid9: 9,
  compare: 2,
} as const;

export type LayoutId = keyof typeof LAYOUT_FRAMES;

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  title: "Portada",
  text: "Texto",
  full: "Imagen completa",
  duo: "Dos imágenes",
  trio: "Tres imágenes",
  quad: "Cuatro imágenes",
  grid9: "Grilla 3×3",
  compare: "Antes / Después",
};

export type SlideItem =
  | { kind: "patientImage"; imageId: string; fit?: "cover" | "contain" }
  | { kind: "asset"; assetId: string; fit?: "cover" | "contain" }
  | {
      /**
       * An external case's scan: the same live viewer as `model3d`, but reading
       * STLs uploaded into the deck instead of a patient's `ModelSet`.
       */
      kind: "assetModel3d";
      upperAssetId?: string;
      lowerAssetId?: string;
      view: "both" | "upper" | "lower";
      snapshotAssetId?: string;
    }
  | {
      kind: "model3d";
      modelSetId: string;
      view: "both" | "upper" | "lower";
      /**
       * A still of the orbited view, captured in the editor. The slide stays
       * live and orbitable on screen; this is what the PDF prints, since a
       * WebGL scene can't be exported from a static document.
       */
      snapshotAssetId?: string;
    }
  | { kind: "text"; body: string };

/**
 * Annotation geometry is normalized 0–1 against the 16:9 slide box, so a shape
 * drawn in the editor lands in the same spot on a projector and exports to PDF
 * as vectors rather than pixels.
 */
export type Annotation =
  | {
      id: string;
      kind: "arrow" | "line";
      from: [number, number];
      to: [number, number];
      color: string;
      width: number;
    }
  | {
      /** A marked spot — a cephalometric landmark, a contact, a lesion. */
      id: string;
      kind: "point";
      x: number;
      y: number;
      color: string;
      width: number;
    }
  | {
      /**
       * Three points measuring the angle at `vertex`. The reading is computed
       * from the geometry every time it is drawn rather than stored, so a
       * dragged point can never disagree with its own number.
       */
      id: string;
      kind: "angle";
      a: [number, number];
      vertex: [number, number];
      b: [number, number];
      color: string;
      width: number;
    }
  | {
      id: string;
      kind: "ellipse" | "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      width: number;
    }
  | {
      id: string;
      kind: "freehand";
      points: [number, number][];
      color: string;
      width: number;
    }
  | {
      id: string;
      kind: "label";
      x: number;
      y: number;
      text: string;
      color: string;
      size: number;
    };

export type AnnotationKind = Annotation["kind"];

export interface Slide {
  id: string;
  layout: LayoutId;
  title?: string;
  /** Shown under the media; on `text` slides this holds the body copy. */
  caption?: string;
  /** Frame slots; length always equals LAYOUT_FRAMES[layout]. */
  frames: (SlideItem | null)[];
  annotations: Annotation[];
  theme?: "light" | "dark";
  /** `compare` slides only — overrides the default "Antes"/"Ahora" chips. */
  compareLabels?: [string, string];
}

export interface PresentationSummary {
  id: string;
  title: string;
  /** Null on an external case — the deck stands alone. */
  patientId: string | null;
  subjectName: string | null;
  /** The patient's name, or the external subject's; always something to show. */
  patientName: string;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Presentation {
  id: string;
  title: string;
  patientId: string | null;
  subjectName: string | null;
  userId: string;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

export interface SlideTemplate {
  id: string;
  title: string;
  slide: Slide;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PresentationAsset {
  id: string;
  contentType: string;
  size: number;
  presentationId: string | null;
  /** Which record slot this file fills; see `ASSET_ROLE` in photo-categories. */
  role: string | null;
  label: string | null;
  createdAt: string;
}

export const isStlAsset = (a: PresentationAsset) =>
  a.contentType === "model/stl";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Blank frame array sized for a layout, preserving what fits when switching. */
export function framesForLayout(
  layout: LayoutId,
  existing: (SlideItem | null)[] = []
): (SlideItem | null)[] {
  const size = LAYOUT_FRAMES[layout];
  return Array.from({ length: size }, (_, i) => existing[i] ?? null);
}

export function emptySlide(layout: LayoutId = "full"): Slide {
  return {
    id: crypto.randomUUID(),
    layout,
    frames: framesForLayout(layout),
    annotations: [],
  };
}

/**
 * Media URLs always stream through the API rather than using signed R2 URLs:
 * signed URLs expire after 15 minutes (a deck open through a consultation
 * would go blank) and, being cross-origin, taint the canvas used by the PDF
 * export.
 */
export function slideItemUrl(item: SlideItem): string | null {
  if (item.kind === "patientImage")
    return `${API_URL}/patient-images/${item.imageId}/file`;
  if (item.kind === "asset") return assetFileUrl(item.assetId);
  return null;
}

export const assetFileUrl = (assetId: string) =>
  `${API_URL}/presentations/assets/${assetId}/file`;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

// ─── Client ─────────────────────────────────────────────────────────────────

export const PresentationsApi = {
  list: async (patientId?: string): Promise<PresentationSummary[]> =>
    json(
      await fetch(
        `${API_URL}/presentations${patientId ? `?patientId=${patientId}` : ""}`,
        { credentials: "include" }
      )
    ),

  get: async (id: string): Promise<Presentation> =>
    json(await fetch(`${API_URL}/presentations/${id}`, { credentials: "include" })),

  /** Pass `patientId` for a patient's deck, `subjectName` for an external case. */
  create: async (input: {
    patientId?: string;
    subjectName?: string;
    title: string;
    slides?: Slide[];
  }): Promise<Presentation> =>
    json(
      await fetch(`${API_URL}/presentations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      })
    ),

  update: async (
    id: string,
    input: { title?: string; subjectName?: string; slides?: Slide[] }
  ): Promise<Presentation> =>
    json(
      await fetch(`${API_URL}/presentations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      })
    ),

  remove: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/presentations/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudo eliminar la presentación");
  },

  /**
   * Upload a file straight into a deck (or the library when id is omitted).
   * Images, plus STL scans for an external case. `role`/`label` file it as a
   * record so the deck can be laid out from it later.
   */
  uploadAsset: async (
    file: Blob,
    presentationId?: string,
    filename = "imagen.png",
    meta?: { role?: string; label?: string }
  ): Promise<PresentationAsset> => {
    const form = new FormData();
    form.append("file", file, filename);
    if (presentationId) form.append("presentationId", presentationId);
    if (meta?.role) form.append("role", meta.role);
    if (meta?.label) form.append("label", meta.label);
    return json(
      await fetch(`${API_URL}/presentations/assets`, {
        method: "POST",
        body: form,
        credentials: "include",
      })
    );
  },

  /** Every file uploaded into a deck — an external case's whole record set. */
  listAssets: async (id: string): Promise<PresentationAsset[]> =>
    json(
      await fetch(`${API_URL}/presentations/${id}/assets`, {
        credentials: "include",
      })
    ),

  removeAsset: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/presentations/assets/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudo eliminar el archivo");
  },
};

export const SlideTemplatesApi = {
  list: async (): Promise<SlideTemplate[]> =>
    json(await fetch(`${API_URL}/slide-templates`, { credentials: "include" })),

  create: async (input: {
    title: string;
    slide: Slide;
    sortOrder?: number;
  }): Promise<SlideTemplate> =>
    json(
      await fetch(`${API_URL}/slide-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      })
    ),

  update: async (
    id: string,
    input: { title?: string; slide?: Slide; sortOrder?: number }
  ): Promise<SlideTemplate> =>
    json(
      await fetch(`${API_URL}/slide-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      })
    ),

  remove: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/slide-templates/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudo eliminar la diapositiva");
  },
};

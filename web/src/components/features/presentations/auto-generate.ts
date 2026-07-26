import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ModelSet, Patient, PatientImage } from "@/lib/types";
import {
  ASSET_ROLE,
  EXTRAORAL_CATEGORIES,
  INTRAORAL_CATEGORIES,
  OCCLUSAL_CATEGORIES,
  XRAY_CATEGORY,
} from "@/lib/photo-categories";
import {
  LayoutId,
  PresentationAsset,
  Slide,
  SlideItem,
} from "@/lib/api/presentations.api";

/**
 * Builds the starting deck from what the patient record already holds. This
 * runs on the client rather than the API because the records taxonomy
 * (`@/lib/photo-categories`) lives here — the API stores slides opaquely.
 *
 * The result is a draft: every slide is editable and deletable afterwards.
 */

type Session = { dateKey: string; images: PatientImage[] };

function groupSessions(images: PatientImage[], type: "PHOTO" | "XRAY"): Session[] {
  const groups = new Map<string, PatientImage[]>();
  for (const img of images) {
    if (img.type !== type) continue;
    const key = format(new Date(img.date), "yyyy-MM-dd");
    const bucket = groups.get(key);
    if (bucket) bucket.push(img);
    else groups.set(key, [img]);
  }
  return [...groups.entries()]
    .map(([dateKey, imgs]) => ({ dateKey, images: imgs }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey)); // oldest first
}

function pick(session: Session | undefined, category: string): SlideItem | null {
  const img = session?.images.find((i) => i.category === category);
  return img ? { kind: "patientImage", imageId: img.id, fit: "contain" } : null;
}

function slide(
  layout: LayoutId,
  frames: (SlideItem | null)[],
  extra: Partial<Slide> = {}
): Slide {
  return {
    id: crypto.randomUUID(),
    layout,
    frames,
    annotations: [],
    ...extra,
  };
}

/** Only emit a media slide if at least one frame actually resolved. */
function pushIfAny(out: Slide[], candidate: Slide) {
  if (candidate.frames.some(Boolean)) out.push(candidate);
}

const longDate = (dateKey: string) =>
  format(new Date(`${dateKey}T12:00:00`), "d 'de' MMMM yyyy", { locale: es });

export function autoGenerateSlides({
  patient,
  images,
  modelSets,
}: {
  patient: Pick<Patient, "fullName">;
  images: PatientImage[];
  modelSets: ModelSet[];
}): Slide[] {
  const photoSessions = groupSessions(images, "PHOTO");
  const xraySessions = groupSessions(images, "XRAY");
  const latestPhotos = photoSessions.at(-1);
  const earliestPhotos = photoSessions[0];
  const latestXrays = xraySessions.at(-1);

  const slides: Slide[] = [];

  // 1. Portada
  slides.push(
    slide("title", [], {
      title: "Tu plan de tratamiento",
      caption: patient.fullName,
    })
  );

  // 2-4. Current records, from the most recent photo session.
  pushIfAny(
    slides,
    slide(
      "trio",
      EXTRAORAL_CATEGORIES.map((c) => pick(latestPhotos, c)),
      {
        title: "Fotografías faciales",
        caption: latestPhotos ? longDate(latestPhotos.dateKey) : undefined,
      }
    )
  );
  pushIfAny(
    slides,
    slide(
      "trio",
      INTRAORAL_CATEGORIES.map((c) => pick(latestPhotos, c)),
      { title: "Cómo muerden tus dientes hoy" }
    )
  );
  pushIfAny(
    slides,
    slide(
      "duo",
      OCCLUSAL_CATEGORIES.map((c) => pick(latestPhotos, c)),
      { title: "Vista de tus arcadas" }
    )
  );

  // 5. Radiografías — one per slide; detail matters more than density here.
  const pano = pick(latestXrays, XRAY_CATEGORY.PANORAMIC);
  if (pano) slides.push(slide("full", [pano], { title: "Radiografía panorámica" }));
  const ceph = pick(latestXrays, XRAY_CATEGORY.LATERAL);
  if (ceph) slides.push(slide("full", [ceph], { title: "Radiografía de perfil" }));

  // 6. The newest scan, live and orbitable while you explain.
  const newestScan = [...modelSets].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
  )[0];
  if (newestScan) {
    slides.push(
      slide(
        "full",
        [{ kind: "model3d", modelSetId: newestScan.id, view: "both" }],
        {
          title: "Tu modelo 3D",
          caption: "Puedes girarlo para verlo desde cualquier ángulo.",
        }
      )
    );
  }

  // 7. Progress: same view, first session vs latest. Only worth a slide once
  //    there are two sessions to compare.
  if (earliestPhotos && latestPhotos && earliestPhotos !== latestPhotos) {
    for (const category of [...INTRAORAL_CATEGORIES, ...EXTRAORAL_CATEGORIES]) {
      const before = pick(earliestPhotos, category);
      const after = pick(latestPhotos, category);
      if (before && after) {
        slides.push(
          slide("compare", [before, after], {
            title: "Tu progreso",
            compareLabels: [
              longDate(earliestPhotos.dateKey),
              longDate(latestPhotos.dateKey),
            ],
          })
        );
        break; // one strong comparison beats six near-identical ones
      }
    }
  }

  slides.push(nextStepsSlide());

  return slides;
}

/** The blank slide the plan gets written on during the consultation. */
function nextStepsSlide(): Slide {
  return slide("text", [], {
    title: "Próximos pasos",
    caption:
      "· Duración estimada:\n· Número de alineadores:\n· Controles:\n· Cuidados importantes:",
  });
}

// ─── External cases ─────────────────────────────────────────────────────────

/** Layout that shows `n` images without leaving holes. */
function layoutFor(n: number): LayoutId {
  if (n <= 1) return "full";
  if (n === 2) return "duo";
  if (n === 3) return "trio";
  if (n <= 4) return "quad";
  return "grid9";
}

/**
 * The same deck, built from records uploaded straight into the presentation
 * instead of from a patient's chart. Roles are the taxonomy the intake page
 * files uploads under (`ASSET_ROLE`), which mirrors `PatientImage.category`.
 */
export function autoGenerateExternalSlides({
  subjectName,
  assets,
}: {
  subjectName: string;
  assets: PresentationAsset[];
}): Slide[] {
  const byRole = (role: string) => assets.filter((a) => a.role === role);
  const one = (role: string): SlideItem | null => {
    const asset = byRole(role)[0];
    return asset ? { kind: "asset", assetId: asset.id, fit: "contain" } : null;
  };

  const slides: Slide[] = [];

  slides.push(
    slide("title", [], { title: "Tu plan de tratamiento", caption: subjectName })
  );

  pushIfAny(
    slides,
    slide("trio", EXTRAORAL_CATEGORIES.map(one), {
      title: "Fotografías faciales",
    })
  );
  pushIfAny(
    slides,
    slide("trio", INTRAORAL_CATEGORIES.map(one), {
      title: "Cómo muerden tus dientes hoy",
    })
  );
  pushIfAny(
    slides,
    slide("duo", OCCLUSAL_CATEGORIES.map(one), { title: "Vista de tus arcadas" })
  );

  const pano = one(XRAY_CATEGORY.PANORAMIC);
  if (pano) slides.push(slide("full", [pano], { title: "Radiografía panorámica" }));
  const ceph = one(XRAY_CATEGORY.LATERAL);
  if (ceph) slides.push(slide("full", [ceph], { title: "Radiografía de perfil" }));

  // One slide per analysis: they are dense pages of numbers, and the label says
  // which analysis it is (Ricketts, Steiner, Wits…).
  for (const analysis of byRole(ASSET_ROLE.CEPH_ANALYSIS)) {
    slides.push(
      slide("full", [{ kind: "asset", assetId: analysis.id, fit: "contain" }], {
        title: analysis.label
          ? `Análisis cefalométrico — ${analysis.label}`
          : "Análisis cefalométrico",
      })
    );
  }

  const upper = byRole(ASSET_ROLE.MODEL_UPPER)[0];
  const lower = byRole(ASSET_ROLE.MODEL_LOWER)[0];
  if (upper || lower) {
    slides.push(
      slide(
        "full",
        [
          {
            kind: "assetModel3d",
            upperAssetId: upper?.id,
            lowerAssetId: lower?.id,
            view: upper && lower ? "both" : upper ? "upper" : "lower",
          },
        ],
        {
          title: "Tu modelo 3D",
          caption: "Puedes girarlo para verlo desde cualquier ángulo.",
        }
      )
    );
  }

  const extras = byRole(ASSET_ROLE.EXTRA_PHOTO);
  for (let i = 0; i < extras.length; i += 4) {
    const chunk = extras.slice(i, i + 4);
    slides.push(
      slide(
        layoutFor(chunk.length),
        chunk.map((a) => ({
          kind: "asset" as const,
          assetId: a.id,
          fit: "contain" as const,
        })),
        { title: i === 0 ? "Otras imágenes" : undefined }
      )
    );
  }

  slides.push(nextStepsSlide());

  return slides;
}

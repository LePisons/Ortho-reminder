import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ModelSet, Patient, PatientImage } from "@/lib/types";
import {
  EXTRAORAL_CATEGORIES,
  INTRAORAL_CATEGORIES,
  OCCLUSAL_CATEGORIES,
  XRAY_CATEGORY,
} from "@/lib/photo-categories";
import { LayoutId, Slide, SlideItem } from "@/lib/api/presentations.api";

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

  // 8. Somewhere to write the plan during the consultation.
  slides.push(
    slide("text", [], {
      title: "Próximos pasos",
      caption:
        "· Duración estimada:\n· Número de alineadores:\n· Controles:\n· Cuidados importantes:",
    })
  );

  return slides;
}

import type { jsPDF } from "jspdf";
import { ModelSet } from "@/lib/types";
import {
  Annotation,
  LayoutId,
  Slide,
  SlideItem,
  slideItemUrl,
} from "@/lib/api/presentations.api";
import { SLIDE_W } from "../annotation-layer";

// Alnix palette (hex — jsPDF has no CSS color parsing), matching
// `estimates/pdf/build-estimate-pdf.ts`.
const BRAND_PURPLE = { r: 0xa0, g: 0x66, b: 0xf8 };
const BRAND_BLUE = { r: 0x64, g: 0x69, b: 0xfc };
const INK = { r: 0x1b, g: 0x1b, b: 0x1b };
const MUTED = { r: 0x6b, g: 0x6b, b: 0x6b };
const PLACEHOLDER = { r: 0xd8, g: 0xd8, b: 0xdd };

// 16:9 landscape, matching the on-screen slide so nothing reflows in export.
const PAGE_W = 297;
const PAGE_H = 167;

/** Stage units (1600×900) → millimetres. */
const U = PAGE_W / SLIDE_W;
const u = (n: number) => n * U;

// Same spacing as the CSS in slide-canvas.tsx, expressed in stage units.
const PAD_X = 56;
const PAD_TOP = 48;
const PAD_BOTTOM = 48;
const GAP = 20;
const TITLE_SIZE = 48;
const TITLE_GAP = 24;
const CAPTION_SIZE = 30;
const CAPTION_GAP = 24;
const COMPARE_CHIP_H = 52;

const GRID: Record<LayoutId, { cols: number; rows: number }> = {
  title: { cols: 0, rows: 0 },
  text: { cols: 0, rows: 0 },
  full: { cols: 1, rows: 1 },
  duo: { cols: 2, rows: 1 },
  trio: { cols: 3, rows: 1 },
  quad: { cols: 2, rows: 2 },
  grid9: { cols: 3, rows: 3 },
  compare: { cols: 2, rows: 1 },
};

type Rect = { x: number; y: number; w: number; h: number };

interface LoadedImage {
  dataUrl: string;
  format: "JPEG";
  width: number;
  height: number;
}

/**
 * Longest edge of an embedded image, in pixels. The page is 297 mm wide, so
 * this is ~137 DPI at full bleed and well over 300 DPI in a grid cell —
 * indistinguishable in print, and the difference between a PDF you can email
 * and one you can't. Intraoral cameras routinely produce 12 MP files.
 */
const MAX_IMAGE_PX = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Fetch, downscale, and re-encode as JPEG so jsPDF embeds a compressed DCT
 * stream. Handing jsPDF a PNG makes it store the raw bitmap instead, which
 * turned a deck of small test images into a 4 MB file.
 *
 * Drawing to a canvas is safe here precisely because slide media streams
 * same-origin through the API (`/patient-images/:id/file`); a signed R2 URL
 * would taint the canvas and make `toDataURL` throw.
 */
async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const scale = Math.min(
      1,
      MAX_IMAGE_PX / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // JPEG has no alpha; without this, transparent PNGs (3D snapshots) would
    // composite onto black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return {
      dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      format: "JPEG",
      width,
      height,
    };
  } catch {
    return null;
  }
}

/** The media a slide needs, keyed by the URL it was fetched from. */
async function preload(
  slides: Slide[]
): Promise<Map<string, LoadedImage | null>> {
  const urls = new Set<string>();
  for (const slide of slides) {
    for (const frame of slide.frames) {
      const url = frameUrl(frame);
      if (url) urls.add(url);
    }
  }
  const entries = await Promise.all(
    [...urls].map(async (url) => [url, await loadImage(url)] as const)
  );
  return new Map(entries);
}

/** A 3D frame prints its captured still, if the user made one. */
function frameUrl(item: SlideItem | null): string | null {
  if (!item) return null;
  if (item.kind === "model3d") {
    return item.snapshotAssetId
      ? slideItemUrl({ kind: "asset", assetId: item.snapshotAssetId })
      : null;
  }
  return slideItemUrl(item);
}

// ─── Drawing ────────────────────────────────────────────────────────────────

/** Fake a linear gradient with thin vertical bands; jsPDF has no gradient API. */
function gradientBand(doc: jsPDF, rect: Rect, steps = 120) {
  const stepW = rect.w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(BRAND_PURPLE.r + (BRAND_BLUE.r - BRAND_PURPLE.r) * t),
      Math.round(BRAND_PURPLE.g + (BRAND_BLUE.g - BRAND_PURPLE.g) * t),
      Math.round(BRAND_PURPLE.b + (BRAND_BLUE.b - BRAND_PURPLE.b) * t)
    );
    // +0.1 overlap keeps hairline seams from showing between bands.
    doc.rect(rect.x + i * stepW, rect.y, stepW + 0.1, rect.h, "F");
  }
}

/** object-contain: fit inside the box, centred, preserving aspect ratio. */
function containRect(img: LoadedImage, box: Rect): Rect {
  const scale = Math.min(box.w / img.width, box.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

function drawFrame(
  doc: jsPDF,
  item: SlideItem | null,
  box: Rect,
  media: Map<string, LoadedImage | null>
) {
  if (!item) return;

  if (item.kind === "text") {
    doc.setFont("Montserrat", "normal");
    doc.setFontSize(u(30) * 2.83);
    doc.setTextColor(INK.r, INK.g, INK.b);
    const lines = doc.splitTextToSize(item.body, box.w - u(16)) as string[];
    lines.forEach((line, i) =>
      doc.text(line, box.x + box.w / 2, box.y + box.h / 2 + i * u(38), {
        align: "center",
      })
    );
    return;
  }

  const url = frameUrl(item);
  const img = url ? media.get(url) : null;

  if (!img) {
    doc.setFillColor(PLACEHOLDER.r, PLACEHOLDER.g, PLACEHOLDER.b);
    doc.rect(box.x, box.y, box.w, box.h, "F");
    doc.setFont("Montserrat", "normal");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(
      item.kind === "model3d"
        ? "Modelo 3D (usa «Capturar vista 3D» para incluirlo)"
        : "Imagen no disponible",
      box.x + box.w / 2,
      box.y + box.h / 2,
      { align: "center", baseline: "middle" }
    );
    return;
  }

  // `cover` would need clipping, which jsPDF doesn't offer; contain never
  // crops, which matters more for clinical photos than filling the box.
  const r = containRect(img, box);
  // The URL doubles as the alias so an image used on several slides — the
  // before/after pair especially — is embedded once, not per occurrence.
  doc.addImage(img.dataUrl, img.format, r.x, r.y, r.w, r.h, url!, "FAST");
}

/**
 * Annotations are drawn as real vector operations rather than rasterized, so
 * an arrow stays sharp at any zoom or print size.
 */
function drawAnnotations(doc: jsPDF, annotations: Annotation[]) {
  const px = (n: number) => n * PAGE_W; // normalized x → mm
  const py = (n: number) => n * PAGE_H;
  // Stroke widths are authored against the 1600-unit stage.
  const sw = (n: number) => Math.max(0.3, u(n));

  for (const a of annotations) {
    const color = "color" in a ? a.color : "#000000";
    const [r, g, b] = hexToRgb(color);
    doc.setDrawColor(r, g, b);
    doc.setFillColor(r, g, b);
    doc.setTextColor(r, g, b);
    doc.setLineJoin("round");
    doc.setLineCap("round");

    switch (a.kind) {
      case "arrow": {
        doc.setLineWidth(sw(a.width));
        const x1 = px(a.from[0]);
        const y1 = py(a.from[1]);
        const x2 = px(a.to[0]);
        const y2 = py(a.to[1]);
        doc.line(x1, y1, x2, y2);
        // Same head geometry as annotation-layer.tsx's arrowHead().
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const len = Math.max(u(18), sw(a.width) * 4);
        const spread = 0.42;
        doc.triangle(
          x2,
          y2,
          x2 - len * Math.cos(angle - spread),
          y2 - len * Math.sin(angle - spread),
          x2 - len * Math.cos(angle + spread),
          y2 - len * Math.sin(angle + spread),
          "F"
        );
        break;
      }
      case "rect":
        doc.setLineWidth(sw(a.width));
        doc.roundedRect(px(a.x), py(a.y), px(a.w), py(a.h), 1.5, 1.5, "S");
        break;
      case "ellipse":
        doc.setLineWidth(sw(a.width));
        doc.ellipse(
          px(a.x + a.w / 2),
          py(a.y + a.h / 2),
          Math.abs(px(a.w / 2)),
          Math.abs(py(a.h / 2)),
          "S"
        );
        break;
      case "freehand": {
        doc.setLineWidth(sw(a.width));
        for (let i = 1; i < a.points.length; i++) {
          doc.line(
            px(a.points[i - 1][0]),
            py(a.points[i - 1][1]),
            px(a.points[i][0]),
            py(a.points[i][1])
          );
        }
        break;
      }
      case "label":
        doc.setFont("Montserrat", "bold");
        // Stage px → pt (1 mm ≈ 2.83 pt).
        doc.setFontSize(u(a.size) * 2.83);
        doc.text(a.text, px(a.x), py(a.y), { baseline: "top" });
        break;
    }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

// ─── Slide renderers ────────────────────────────────────────────────────────

function drawTitleSlide(doc: jsPDF, slide: Slide, patientName: string) {
  gradientBand(doc, { x: 0, y: 0, w: PAGE_W, h: PAGE_H });
  doc.setTextColor(255, 255, 255);
  doc.setFont("Montserrat", "bold");
  doc.setFontSize(34);
  const lines = doc.splitTextToSize(
    slide.title || "Tu tratamiento",
    PAGE_W - u(PAD_X) * 2 - 40
  ) as string[];
  const blockH = lines.length * 14;
  let y = PAGE_H / 2 - blockH / 2;
  for (const line of lines) {
    doc.text(line, u(96), y);
    y += 14;
  }
  doc.setFont("Montserrat", "normal");
  doc.setFontSize(16);
  doc.text(slide.caption || patientName, u(96), y + 8);
}

function drawTextSlide(doc: jsPDF, slide: Slide) {
  doc.setTextColor(INK.r, INK.g, INK.b);
  let y = u(180);
  if (slide.title) {
    doc.setFont("Montserrat", "bold");
    doc.setFontSize(28);
    for (const line of doc.splitTextToSize(
      slide.title,
      PAGE_W - u(96) * 2
    ) as string[]) {
      doc.text(line, u(96), y);
      y += 12;
    }
    y += 8;
  }
  if (slide.caption) {
    doc.setFont("Montserrat", "normal");
    doc.setFontSize(15);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    for (const line of doc.splitTextToSize(
      slide.caption,
      PAGE_W - u(96) * 2
    ) as string[]) {
      doc.text(line, u(96), y);
      y += 9;
    }
  }
}

function drawMediaSlide(
  doc: jsPDF,
  slide: Slide,
  media: Map<string, LoadedImage | null>
) {
  let top = u(PAD_TOP);
  const left = u(PAD_X);
  const width = PAGE_W - left * 2;
  let bottom = PAGE_H - u(PAD_BOTTOM);

  if (slide.title) {
    doc.setFont("Montserrat", "bold");
    doc.setFontSize(u(TITLE_SIZE) * 2.83);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(slide.title, left, top, { baseline: "top" });
    top += u(TITLE_SIZE + TITLE_GAP);
  }

  if (slide.caption) {
    doc.setFont("Montserrat", "normal");
    doc.setFontSize(u(CAPTION_SIZE) * 2.83);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    bottom -= u(CAPTION_SIZE);
    doc.text(slide.caption, left, PAGE_H - u(PAD_BOTTOM), { baseline: "bottom" });
    bottom -= u(CAPTION_GAP);
  }

  const { cols, rows } = GRID[slide.layout];
  if (!cols || !rows) return;

  const chipH = slide.layout === "compare" ? u(COMPARE_CHIP_H) : 0;
  const cellW = (width - u(GAP) * (cols - 1)) / cols;
  const cellH = (bottom - top - u(GAP) * (rows - 1)) / rows;

  slide.frames.forEach((frame, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = left + col * (cellW + u(GAP));
    const y = top + row * (cellH + u(GAP));

    if (slide.layout === "compare") {
      const label =
        slide.compareLabels?.[i] ?? (i === 0 ? "Antes" : "Ahora");
      if (i === 0) {
        doc.setFillColor(0xe5, 0xe7, 0xeb);
        doc.setTextColor(INK.r, INK.g, INK.b);
      } else {
        doc.setFillColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
        doc.setTextColor(255, 255, 255);
      }
      doc.setFont("Montserrat", "bold");
      doc.setFontSize(11);
      const chipW = doc.getTextWidth(label) + 10;
      doc.roundedRect(x, y, chipW, chipH - 3, 3, 3, "F");
      doc.text(label, x + 5, y + (chipH - 3) / 2, { baseline: "middle" });
    }

    drawFrame(doc, frame, {
      x,
      y: y + chipH,
      w: cellW,
      h: cellH - chipH,
    }, media);
  });
}

// ─── Entry point ────────────────────────────────────────────────────────────

export function presentationFileName(title: string, patientName: string) {
  const safe = (s: string) =>
    s.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "");
  return `${safe(title) || "Presentacion"}_${safe(patientName) || "Paciente"}.pdf`;
}

export async function buildPresentationPdf({
  title,
  patientName,
  slides,
}: {
  title: string;
  patientName: string;
  slides: Slide[];
  /** Accepted for call-site symmetry; 3D prints from its captured still. */
  modelSets?: ModelSet[];
}): Promise<Blob> {
  const [{ jsPDF: JsPdf }, fonts, media] = await Promise.all([
    import("jspdf"),
    import("@/components/features/estimates/pdf/fonts"),
    preload(slides),
  ]);

  const doc = new JsPdf({
    unit: "mm",
    format: [PAGE_W, PAGE_H],
    orientation: "landscape",
  });
  doc.addFileToVFS("Montserrat-Regular.ttf", fonts.MONTSERRAT_REGULAR);
  doc.addFont("Montserrat-Regular.ttf", "Montserrat", "normal");
  doc.addFileToVFS("Montserrat-Bold.ttf", fonts.MONTSERRAT_BOLD);
  doc.addFont("Montserrat-Bold.ttf", "Montserrat", "bold");
  doc.setFont("Montserrat", "normal");
  doc.setProperties({ title, subject: patientName });

  slides.forEach((slide, i) => {
    if (i > 0) doc.addPage([PAGE_W, PAGE_H], "landscape");

    if (slide.theme === "dark") {
      doc.setFillColor(0x1b, 0x1b, 0x1b);
      doc.rect(0, 0, PAGE_W, PAGE_H, "F");
    }

    if (slide.layout === "title") drawTitleSlide(doc, slide, patientName);
    else if (slide.layout === "text") drawTextSlide(doc, slide);
    else drawMediaSlide(doc, slide, media);

    drawAnnotations(doc, slide.annotations);
  });

  return doc.output("blob");
}

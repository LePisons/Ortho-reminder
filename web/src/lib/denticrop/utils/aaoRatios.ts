// AAO (American Association of Orthodontists) standard photo ratios:
// extraoral portrait 3:4 (w:h), intraoral landscape 3:2 (w:h).

export type PhotoCategory = "extraoral" | "intraoral";

export const AAO_RATIOS: Record<PhotoCategory, number> = {
  extraoral: 3 / 4,
  intraoral: 3 / 2,
};

export const AAO_RATIO_LABELS: Record<PhotoCategory, string> = {
  extraoral: "3:4",
  intraoral: "3:2",
};

/**
 * Maps a Roboflow class name (e.g. "Extraoral_frontal", "Intraoral_oclusal_inferior")
 * to its photo category. Returns null for unknown classes so callers can no-op.
 */
export function getPhotoCategory(
  className?: string | null,
): PhotoCategory | null {
  if (!className) return null;
  const c = className.toLowerCase();
  if (c.startsWith("extraoral")) return "extraoral";
  if (c.startsWith("intraoral")) return "intraoral";
  return null;
}

export function getStandardRatio(className?: string | null): number | null {
  const category = getPhotoCategory(className);
  return category ? AAO_RATIOS[category] : null;
}

export function getStandardRatioLabel(
  className?: string | null,
): string | null {
  const category = getPhotoCategory(className);
  return category ? AAO_RATIO_LABELS[category] : null;
}

export interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Expands a bounding box to the target w/h ratio while keeping it inside the image:
 * 1. Intersect bbox with image bounds (detections can overflow after un-letterboxing).
 * 2. Grow around the bbox center to the minimal containing rect at the ratio.
 * 3. If that rect doesn't fit the image, retain the detection's available
 *    bounds. Preserving anatomy takes priority over enforcing the ratio.
 * 4. Center on the bbox center, then shift inside the image bounds.
 * Returns float coordinates; callers should floor when sizing canvases.
 */
export function expandBoxToRatio(
  bbox: BoxRect,
  ratio: number,
  imageW: number,
  imageH: number,
): BoxRect {
  // 1. Intersect bbox with image bounds
  const bx = Math.max(0, Math.min(bbox.x, imageW));
  const by = Math.max(0, Math.min(bbox.y, imageH));
  const bw = Math.max(1, Math.min(bbox.x + bbox.width, imageW) - bx);
  const bh = Math.max(1, Math.min(bbox.y + bbox.height, imageH) - by);

  // 2. Minimal containing rect at the target ratio
  let w = bw;
  let h = bh;
  if (w / h < ratio) {
    w = h * ratio;
  } else {
    h = w / ratio;
  }

  // 3. Preserve anatomy when the ratio cannot fit.
  // When the requested ratio cannot contain the detection within the source,
  // keep all available anatomy instead of silently cutting the detection.
  if (w > imageW || h > imageH) {
    return { x: bx, y: by, width: bw, height: bh };
  }

  // 4. Center on the bbox center, clamp inside the image
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const x = Math.max(0, Math.min(cx - w / 2, imageW - w));
  const y = Math.max(0, Math.min(cy - h / 2, imageH - h));

  return { x, y, width: w, height: h };
}

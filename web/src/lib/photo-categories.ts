/**
 * The orthodontic records taxonomy. These strings are persisted on
 * `PatientImage.category`, so they are effectively part of the data format —
 * renaming one orphans every image already filed under it.
 *
 * Kept here rather than inside the photo grid component because the
 * presentation auto-generator matches on the same values; a silent drift
 * between the two would produce empty slides with no error.
 */
export const PHOTO_CATEGORY = {
  RIGHT_PROFILE: "Right Profile",
  FRONTAL: "Frontal",
  SMILE: "Smile",
  UPPER_OCCLUSAL: "Upper Occlusal",
  LOWER_OCCLUSAL: "Lower Occlusal",
  INTRAORAL_RIGHT: "Intraoral Right",
  INTRAORAL_FRONTAL: "Intraoral Frontal",
  INTRAORAL_LEFT: "Intraoral Left",
} as const;

export const XRAY_CATEGORY = {
  PANORAMIC: "Panoramic",
  LATERAL: "Lateral",
} as const;

/** Extraoral views, in the order they're presented. */
export const EXTRAORAL_CATEGORIES = [
  PHOTO_CATEGORY.RIGHT_PROFILE,
  PHOTO_CATEGORY.FRONTAL,
  PHOTO_CATEGORY.SMILE,
];

/** Intraoral lateral + frontal views, left-to-right as the patient faces you. */
export const INTRAORAL_CATEGORIES = [
  PHOTO_CATEGORY.INTRAORAL_RIGHT,
  PHOTO_CATEGORY.INTRAORAL_FRONTAL,
  PHOTO_CATEGORY.INTRAORAL_LEFT,
];

export const OCCLUSAL_CATEGORIES = [
  PHOTO_CATEGORY.UPPER_OCCLUSAL,
  PHOTO_CATEGORY.LOWER_OCCLUSAL,
];

/** Spanish labels for the UI; the stored values stay English. */
export const CATEGORY_LABELS_ES: Record<string, string> = {
  [PHOTO_CATEGORY.RIGHT_PROFILE]: "Perfil derecho",
  [PHOTO_CATEGORY.FRONTAL]: "Frontal",
  [PHOTO_CATEGORY.SMILE]: "Sonrisa",
  [PHOTO_CATEGORY.UPPER_OCCLUSAL]: "Oclusal superior",
  [PHOTO_CATEGORY.LOWER_OCCLUSAL]: "Oclusal inferior",
  [PHOTO_CATEGORY.INTRAORAL_RIGHT]: "Intraoral derecha",
  [PHOTO_CATEGORY.INTRAORAL_FRONTAL]: "Intraoral frontal",
  [PHOTO_CATEGORY.INTRAORAL_LEFT]: "Intraoral izquierda",
  [XRAY_CATEGORY.PANORAMIC]: "Panorámica",
  [XRAY_CATEGORY.LATERAL]: "Telerradiografía lateral",
};

export function categoryLabel(category?: string): string {
  if (!category) return "Sin categoría";
  return CATEGORY_LABELS_ES[category] ?? category;
}

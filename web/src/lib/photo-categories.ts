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

/**
 * An external case has no `PatientImage` rows, so the same taxonomy is stored
 * on `PresentationAsset.role` instead — plus the slots a patient record keeps
 * elsewhere (scans in `ModelSet`, analyses nowhere at all). Persisted values:
 * treat them like the categories above.
 */
export const ASSET_ROLE = {
  ...PHOTO_CATEGORY,
  ...XRAY_CATEGORY,
  /** A cephalometric analysis page — Ricketts, Steiner, Wits… — as an image. */
  CEPH_ANALYSIS: "CephAnalysis",
  /** A photo outside the standard series: a close-up, an old record, a smile. */
  EXTRA_PHOTO: "ExtraPhoto",
  MODEL_UPPER: "Model3dUpper",
  MODEL_LOWER: "Model3dLower",
} as const;

export type AssetRole = (typeof ASSET_ROLE)[keyof typeof ASSET_ROLE];

/** Photo slots of an external case's records, in records-sheet order. */
export const EXTERNAL_PHOTO_SLOTS = [
  ...EXTRAORAL_CATEGORIES,
  ...INTRAORAL_CATEGORIES,
  ...OCCLUSAL_CATEGORIES,
];

export const ASSET_ROLE_LABELS_ES: Record<string, string> = {
  ...CATEGORY_LABELS_ES,
  [ASSET_ROLE.CEPH_ANALYSIS]: "Análisis cefalométrico",
  [ASSET_ROLE.EXTRA_PHOTO]: "Otra foto",
  [ASSET_ROLE.MODEL_UPPER]: "Modelo superior",
  [ASSET_ROLE.MODEL_LOWER]: "Modelo inferior",
};

export function roleLabel(role?: string | null): string {
  if (!role) return "Sin categoría";
  return ASSET_ROLE_LABELS_ES[role] ?? role;
}

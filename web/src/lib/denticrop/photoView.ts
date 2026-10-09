// Translate detector labels into case views; unknown/ambiguous classes stay manual.
export function detectedPhotoView(label?: string): string | undefined {
  const normalized = label
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const views: Record<string, string> = {
    extraoral_frontal: "EXTRAORAL_FRONT",
    extraoral_frontal_reposo: "EXTRAORAL_FRONT",
    extraoral_frontal_sonrisa: "EXTRAORAL_SMILE",
    extraoral_sonrisa: "EXTRAORAL_SMILE",
    extraoral_sonriendo: "EXTRAORAL_SMILE",
    extraoral_perfil: "EXTRAORAL_PROFILE",
    intraoral_frontal: "INTRAORAL_FRONT",
    intraoral_lateral_derecha: "INTRAORAL_RIGHT",
    intraoral_lateral_derecho: "INTRAORAL_RIGHT",
    intraoral_lateral_izquierda: "INTRAORAL_LEFT",
    intraoral_lateral_izquierdo: "INTRAORAL_LEFT",
    intraoral_oclusal_superior: "OCCLUSAL_UPPER",
    intraoral_oclusal_inferior: "OCCLUSAL_LOWER",
    intraoral_occlusal_superior: "OCCLUSAL_UPPER",
    intraoral_occlusal_inferior: "OCCLUSAL_LOWER",
  };
  return normalized ? views[normalized] : undefined;
}

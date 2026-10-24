import { MIN_PUBLISH_PHOTOS } from "@/lib/residences/photos";

/**
 * Fortaleza del perfil de una residencia (Ciclo 65). Función pura: la usa el
 * formulario del perfil (con el estado en edición) para el % y la sugerencia.
 *
 * Las fotos pesan más que el resto (son requisito para publicar): 25 puntos,
 * proporcionales a cuántas de las 3 mínimas hay. Los 7 puntos restantes
 * reparten 75 puntos.
 */
export interface ProfileStrengthInput {
  tagline: string;
  description: string;
  services: number;
  commonAreas: number;
  rulesSummary: string;
  nearUniversities: number;
  photos: number;
  /** Hay al menos un tipo de habitación y todos tienen tarifa mayor a 0. */
  roomTypesOk: boolean;
}

export interface ProfileStrengthGap {
  key: "tagline" | "description" | "services" | "commonAreas" | "rules" | "universities" | "roomTypes";
  label: string;
}

export interface ProfileStrength {
  percent: number;
  photosMissing: number;
  gaps: ProfileStrengthGap[];
}

const PHOTO_WEIGHT = 25;
const OTHER_WEIGHT = 75 / 7;

export function computeProfileStrength(input: ProfileStrengthInput): ProfileStrength {
  const photos = Number.isFinite(input.photos) ? Math.max(0, Math.floor(input.photos)) : 0;
  const photosMissing = Math.max(0, MIN_PUBLISH_PHOTOS - photos);

  const checks: (ProfileStrengthGap & { ok: boolean })[] = [
    { key: "tagline", label: "el eslogan", ok: input.tagline.trim().length > 0 },
    { key: "description", label: "la descripción", ok: input.description.trim().length > 20 },
    { key: "services", label: "los servicios", ok: input.services > 0 },
    { key: "commonAreas", label: "los espacios comunes", ok: input.commonAreas > 0 },
    { key: "rules", label: "las reglas de convivencia", ok: input.rulesSummary.trim().length > 0 },
    { key: "universities", label: "las universidades cercanas", ok: input.nearUniversities > 0 },
    { key: "roomTypes", label: "los tipos de habitación y sus tarifas", ok: input.roomTypesOk },
  ];

  const photoPoints = (Math.min(photos, MIN_PUBLISH_PHOTOS) / MIN_PUBLISH_PHOTOS) * PHOTO_WEIGHT;
  const otherPoints = checks.filter((c) => c.ok).length * OTHER_WEIGHT;
  return {
    percent: Math.min(100, Math.round(photoPoints + otherPoints)),
    photosMissing,
    gaps: checks.filter((c) => !c.ok).map(({ key, label }) => ({ key, label })),
  };
}

/** Sugerencia en voseo que coincide con lo que realmente falta; `null` si no falta nada. */
export function profileStrengthSuggestion(strength: ProfileStrength): string | null {
  const parts: string[] = [];
  if (strength.photosMissing > 0) {
    parts.push(
      strength.photosMissing === MIN_PUBLISH_PHOTOS
        ? `cargá al menos ${MIN_PUBLISH_PHOTOS} fotos (todavía no hay ninguna)`
        : `sumá ${strength.photosMissing === 1 ? "1 foto más" : `${strength.photosMissing} fotos más`} (hacen falta ${MIN_PUBLISH_PHOTOS} para publicar)`,
    );
  }
  if (strength.gaps.length > 0) {
    parts.push(`completá ${joinList(strength.gaps.map((g) => g.label))}`);
  }
  if (parts.length === 0) return null;
  return `Sugerencia: ${parts.join(" y ")}.`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

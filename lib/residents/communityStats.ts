/**
 * Cifras agregadas de la comunidad de una residencia (ficha pública, propuesta Comunidad C + cifras de A).
 *
 * Privacidad: solo cuentan los perfiles que cada estudiante eligió mostrar (`kind: "profile"`), y una cifra
 * únicamente se publica si al menos `MIN_PROFILES_FOR_STATS` perfiles aportan ese dato — así ningún agregado
 * (un país, un rango de edad, una carrera) puede apuntar a una sola persona. Es una función pura: recibe las
 * tarjetas que el viewer ya tiene permitido ver y no lee nada más. El visitante anónimo no recibe estos campos
 * (ver `getCommunityVisibility`), por lo que para él las cifras siempre dan `null`.
 */
export const MIN_PROFILES_FOR_STATS = 3;
/** El rango de edades expone los extremos, así que pide más aportes que países o carreras. */
export const MIN_AGES_FOR_RANGE = 5;

export type CommunityStatsCard = {
  kind: "profile" | "placeholder";
  age?: number | null;
  nationality?: string | null;
  career?: string | null;
};

export type CommunityStats = {
  /** Perfiles visibles para este viewer. */
  visibleProfiles: number;
  /** Países distintos; `null` si menos de 3 perfiles lo comparten. */
  countries: number | null;
  /** Rango de edades; `null` si menos de 5 perfiles lo comparten. */
  ageRange: { min: number; max: number } | null;
  /** Carreras distintas; `null` si menos de 3 perfiles lo comparten. */
  careers: number | null;
};

/** Clave de comparación: sin tildes, sin mayúsculas ni espacios de más ("Psicología" == " psicologia "). */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function distinctCount(values: (string | null | undefined)[]): number | null {
  const present = values.map((v) => (typeof v === "string" ? normalize(v) : "")).filter((v) => v.length > 0);
  if (present.length < MIN_PROFILES_FOR_STATS) return null;
  return new Set(present).size;
}

/** `null` si hay menos de 3 perfiles visibles o si ninguna cifra alcanza el mínimo. */
export function computeCommunityStats(cards: readonly CommunityStatsCard[]): CommunityStats | null {
  const profiles = cards.filter((c) => c.kind === "profile");
  if (profiles.length < MIN_PROFILES_FOR_STATS) return null;

  const ages = profiles
    .map((c) => c.age)
    .filter((a): a is number => typeof a === "number" && Number.isFinite(a) && a > 0);
  const ageRange =
    ages.length >= MIN_AGES_FOR_RANGE ? { min: Math.min(...ages), max: Math.max(...ages) } : null;
  const countries = distinctCount(profiles.map((c) => c.nationality));
  const careers = distinctCount(profiles.map((c) => c.career));

  if (countries === null && ageRange === null && careers === null) return null;
  return { visibleProfiles: profiles.length, countries, ageRange, careers };
}

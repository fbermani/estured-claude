/**
 * H04 (Ciclo 49) — control del estudiante sobre su perfil en la comunidad
 * de la residencia (docs/00 §18, docs/10 §7 y §9.2). Lógica pura (sin
 * `server-only`) para poder testearla sin base de datos.
 *
 * - El interruptor maestro (`is_individual_profile_visible`) arranca en
 *   `false`: el estudiante lo activa a conciencia (en el registro o acá).
 * - Cada dato (`show_*_to_registered`) es independiente y arranca en `false`.
 * - Un menor NO puede activar nada: todo queda en `false` (docs/10 §9.2).
 */
export const VISIBILITY_FLAG_COLUMNS = [
  "show_age_to_registered",
  "show_nationality_to_registered",
  "show_career_to_registered",
  "show_origin_city_to_registered",
  "show_habits_to_registered",
  "show_interests_to_registered",
] as const;

export type VisibilityFlagColumn = (typeof VISIBILITY_FLAG_COLUMNS)[number];

export type VisibilityValues = Record<VisibilityFlagColumn, boolean> & {
  is_individual_profile_visible: boolean;
};

export const MINOR_VISIBILITY_MESSAGE =
  "Mientras seas menor de 18 tu perfil no aparece en la comunidad. Cuando cumplas 18 vas a poder activarlo.";

export function allHidden(): VisibilityValues {
  return {
    is_individual_profile_visible: false,
    show_age_to_registered: false,
    show_nationality_to_registered: false,
    show_career_to_registered: false,
    show_origin_city_to_registered: false,
    show_habits_to_registered: false,
    show_interests_to_registered: false,
  };
}

export type ResolveVisibilityResult =
  | { ok: true; values: VisibilityValues }
  | { ok: false; error: string };

/**
 * Valores finales a guardar a partir de lo que mandó el formulario.
 * - Menor: siempre todo `false`; si intentó activar el maestro, es error.
 * - Adulto con maestro apagado: se guarda solo el maestro y se conservan
 *   los datos que ya tenía elegidos (`current`), para que apagar y volver
 *   a prender no le borre sus preferencias.
 * - Adulto con maestro prendido: cada dato vale lo que mandó, de forma
 *   independiente.
 */
export function resolveVisibilityUpdate(params: {
  isMinor: boolean;
  input: VisibilityValues;
  current: VisibilityValues | null;
}): ResolveVisibilityResult {
  const { isMinor, input, current } = params;
  if (isMinor) {
    const triedToEnable = input.is_individual_profile_visible || VISIBILITY_FLAG_COLUMNS.some((c) => input[c]);
    if (triedToEnable) return { ok: false, error: MINOR_VISIBILITY_MESSAGE };
    return { ok: true, values: allHidden() };
  }
  if (!input.is_individual_profile_visible) {
    const kept = current ?? allHidden();
    return { ok: true, values: { ...kept, is_individual_profile_visible: false } };
  }
  const values = allHidden();
  values.is_individual_profile_visible = true;
  for (const c of VISIBILITY_FLAG_COLUMNS) values[c] = input[c] === true;
  return { ok: true, values };
}

/** Lo que ve un usuario registrado del perfil de un estudiante (misma regla que `getCommunityVisibility`). */
export type CommunityPreviewData = {
  firstName: string;
  age: number | null;
  nationality: string | null;
  countryFlag: string | null;
  career: string | null;
  originCity: string | null;
  bio: string | null;
  habits: string[];
  interests: string[];
};

export type CommunityPreview =
  | { kind: "placeholder" }
  | {
      kind: "profile";
      firstName: string;
      age: number | null;
      nationality: string | null;
      countryFlag: string | null;
      career: string | null;
      originCity: string | null;
      bio: string | null;
      habits: string[];
      interests: string[];
    };

export function buildCommunityPreview(params: {
  isMinor: boolean;
  values: VisibilityValues;
  data: CommunityPreviewData;
}): CommunityPreview {
  const { isMinor, values, data } = params;
  if (isMinor || !values.is_individual_profile_visible) return { kind: "placeholder" };
  return {
    kind: "profile",
    firstName: data.firstName,
    age: values.show_age_to_registered ? data.age : null,
    nationality: values.show_nationality_to_registered ? data.nationality : null,
    countryFlag: values.show_nationality_to_registered ? data.countryFlag : null,
    career: values.show_career_to_registered ? data.career : null,
    originCity: values.show_origin_city_to_registered ? data.originCity : null,
    bio: data.bio,
    habits: values.show_habits_to_registered ? data.habits : [],
    interests: values.show_interests_to_registered ? data.interests : [],
  };
}

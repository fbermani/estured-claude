import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Alta de estudiante en 2 pasos (Ciclo 35, decisión del dueño): el
 * registro (paso 1) solo pide identidad básica + contacto. Estos
 * ítems son lo que queda para "perfil completo" — se piden después,
 * sin bloquear el alta ni el uso del producto. Ciclo 36 (pedido del
 * dueño): sumó `bio`/`interests`/`habits` — cada campo nuevo del
 * perfil de comunidad debe aportar al porcentaje, no ser solo
 * cosmético.
 */
export interface ProfileCompletenessItem {
  key:
    | "nationality"
    | "study_institution"
    | "origin_city"
    | "student_identity"
    | "student_academic_proof"
    | "bio"
    | "interests"
    | "habits";
  label: string;
  /** Mensaje motivacional para mostrar cuando falta — más largo/persuasivo que `label`. */
  message: string;
  done: boolean;
}

export interface ProfileCompleteness {
  percent: number;
  items: ProfileCompletenessItem[];
  missing: ProfileCompletenessItem[];
}

export function computeProfileCompleteness(input: {
  nationality: string | null;
  studyInstitutionPrivate: string | null;
  originCity: string | null;
  hasIdentityDocument: boolean;
  hasAcademicProofDocument: boolean;
  bio: string | null;
  interestsCount: number;
  habitsCount: number;
}): ProfileCompleteness {
  const items: ProfileCompletenessItem[] = [
    {
      key: "nationality",
      label: "Nacionalidad",
      message: "Elegí tu nacionalidad para que las residencias te conozcan mejor.",
      done: !!input.nationality,
    },
    {
      key: "study_institution",
      label: "Dónde vas a estudiar",
      message: "Contanos dónde vas a estudiar — nos ayuda a mostrarte residencias bien ubicadas.",
      done: !!input.studyInstitutionPrivate,
    },
    {
      key: "origin_city",
      label: "Ciudad de origen",
      message: "Agregá tu ciudad de origen para completar tu perfil.",
      done: !!input.originCity,
    },
    {
      key: "student_identity",
      label: "Documento de identidad",
      message: "Subí tu documento de identidad para dar más confianza a las residencias.",
      done: input.hasIdentityDocument,
    },
    {
      key: "student_academic_proof",
      label: "Comprobante de estudio",
      message: "Subí tu comprobante de estudio para respaldar tu solicitud.",
      done: input.hasAcademicProofDocument,
    },
    {
      key: "bio",
      label: "Sobre mí",
      message: "Agregá una descripción personal para generar mayor confianza.",
      done: !!input.bio?.trim(),
    },
    {
      key: "interests",
      label: "Intereses",
      message: "Completá tus intereses para aumentar las posibilidades de ser aceptado.",
      done: input.interestsCount > 0,
    },
    {
      key: "habits",
      label: "Hábitos",
      message: "Contanos tus hábitos de convivencia — ayuda a generar mejores convivencias.",
      done: input.habitsCount > 0,
    },
  ];
  const doneCount = items.filter((i) => i.done).length;
  return {
    percent: Math.round((doneCount / items.length) * 100),
    items,
    missing: items.filter((i) => !i.done),
  };
}

/** Server-side: arma el input de `computeProfileCompleteness` para un estudiante dado su `user_id` de sesión. */
export async function getStudentProfileCompleteness(
  admin: SupabaseClient,
  userId: string,
): Promise<ProfileCompleteness | null> {
  const { data: profile } = await admin
    .from("student_profiles")
    .select("id, nationality, study_institution_private, origin_city, bio, interests, habits")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return null;

  const { data: files } = await admin
    .from("files")
    .select("document_type")
    .eq("related_entity_type", "student_profiles")
    .eq("related_entity_id", profile.id)
    .in("document_type", ["student_identity", "student_academic_proof"]);
  const types = new Set((files ?? []).map((f) => f.document_type));

  const interestsItems = (profile.interests as { items?: unknown } | null)?.items;
  const habitsItems = (profile.habits as { items?: unknown } | null)?.items;

  return computeProfileCompleteness({
    nationality: profile.nationality,
    studyInstitutionPrivate: profile.study_institution_private,
    originCity: profile.origin_city,
    hasIdentityDocument: types.has("student_identity"),
    hasAcademicProofDocument: types.has("student_academic_proof"),
    bio: profile.bio,
    interestsCount: Array.isArray(interestsItems) ? interestsItems.length : 0,
    habitsCount: Array.isArray(habitsItems) ? habitsItems.length : 0,
  });
}

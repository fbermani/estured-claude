import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Alta de estudiante en 2 pasos (Ciclo 35, decisión del dueño): el
 * registro (paso 1) solo pide identidad básica + contacto. Estos 5
 * ítems son lo que queda para "perfil completo" — se piden después,
 * sin bloquear el alta ni el uso del producto.
 */
export interface ProfileCompletenessItem {
  key: "nationality" | "study_institution" | "origin_city" | "student_identity" | "student_academic_proof";
  label: string;
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
}): ProfileCompleteness {
  const items: ProfileCompletenessItem[] = [
    { key: "nationality", label: "Nacionalidad", done: !!input.nationality },
    { key: "study_institution", label: "Dónde vas a estudiar", done: !!input.studyInstitutionPrivate },
    { key: "origin_city", label: "Ciudad de origen", done: !!input.originCity },
    { key: "student_identity", label: "Documento de identidad", done: input.hasIdentityDocument },
    { key: "student_academic_proof", label: "Comprobante de estudio", done: input.hasAcademicProofDocument },
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
    .select("id, nationality, study_institution_private, origin_city")
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

  return computeProfileCompleteness({
    nationality: profile.nationality,
    studyInstitutionPrivate: profile.study_institution_private,
    originCity: profile.origin_city,
    hasIdentityDocument: types.has("student_identity"),
    hasAcademicProofDocument: types.has("student_academic_proof"),
  });
}

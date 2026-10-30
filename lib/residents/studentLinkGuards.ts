import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveFamilyOfStudent } from "@/lib/family/access";

export const MINOR_NEEDS_GUARDIAN_MESSAGE =
  "Para vincular tu estadía necesitás un familiar o tutor vinculado, porque sos menor de 18. Invitalo desde tu panel y volvé a abrir este enlace: sigue valiendo.";
export const ALREADY_HAS_STAY_MESSAGE = "Ya tenés una estadía vigente vinculada a tu cuenta. Si cambiaste de residencia, avisá a Soporte.";

export type StudentLinkGuard = { ok: true } | { ok: false; error: string };

/**
 * Condiciones para vincular a un estudiante a una estadía (DR19, punto C): una sola estadía vigente por estudiante y, si es menor
 * (`docs/00` §17), con un familiar/tutor con vínculo ACTIVO. Falla cerrado ante un error de lectura.
 */
export async function checkStudentCanLink(admin: SupabaseClient, studentProfileId: string): Promise<StudentLinkGuard> {
  const { data: profile, error: profileError } = await admin
    .from("student_profiles")
    .select("id, is_minor")
    .eq("id", studentProfileId)
    .maybeSingle();
  if (profileError || !profile) {
    if (profileError) console.error("[residents] checkStudentCanLink profile read failed:", profileError);
    return { ok: false, error: "No pudimos verificar tu perfil. Intentá de nuevo." };
  }

  const { data: current, error: currentError } = await admin
    .from("resident_stays")
    .select("id")
    .eq("student_profile_id", studentProfileId)
    .eq("is_current", true)
    .limit(1);
  if (currentError) {
    console.error("[residents] checkStudentCanLink stays read failed:", currentError);
    return { ok: false, error: "No pudimos verificar tu estadía. Intentá de nuevo." };
  }
  if (current && current.length > 0) return { ok: false, error: ALREADY_HAS_STAY_MESSAGE };

  if ((profile as { is_minor?: boolean }).is_minor) {
    const family = await loadActiveFamilyOfStudent(admin, studentProfileId);
    if (!family) return { ok: false, error: MINOR_NEEDS_GUARDIAN_MESSAGE };
  }
  return { ok: true };
}

/** ¿El mail corresponde a una cuenta de estudiante menor sin tutor vinculado? (la residencia no conoce la edad: se chequea al invitar si ya hay cuenta). */
export async function emailBelongsToUnguardedMinor(admin: SupabaseClient, email: string): Promise<boolean> {
  const { data: user } = await admin.from("users").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!user) return false;
  const { data: profile } = await admin.from("student_profiles").select("id, is_minor").eq("user_id", (user as { id: string }).id).maybeSingle();
  if (!profile || !(profile as { is_minor?: boolean }).is_minor) return false;
  return (await loadActiveFamilyOfStudent(admin, (profile as { id: string }).id)) === null;
}

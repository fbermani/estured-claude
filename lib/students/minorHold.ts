import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";

/**
 * DR65 (e) (LEG-004): la cuenta de un estudiante de 14 a 17 años queda EN ESPERA hasta que un familiar con vínculo ACTIVO registra su
 * consentimiento (`consents.consent_type = guardian_consent`, `user_id` = el familiar, `related_entity` = el perfil del estudiante).
 * La minoría sale de `birth_date` en cada consulta (no del flag `is_minor`). Ante un error de lectura, la cuenta se trata como en
 * espera (falla cerrado). Lo usan las acciones del estudiante que tratan datos o generan efectos, y el aviso del área.
 */
export const GUARDIAN_CONSENT_TYPE = "guardian_consent";

export const MINOR_ON_HOLD_MESSAGE =
  "Tu cuenta está en espera: como sos menor de 18, tu familiar responsable tiene que vincularse y dar su consentimiento. Invitalo desde «Mi perfil».";

/** Ya hay un vínculo activo: solo falta que ese familiar dé su consentimiento. */
export const MINOR_ON_HOLD_LINKED_MESSAGE =
  "Tu cuenta está en espera: como sos menor de 18, falta el consentimiento de tu familiar responsable. Pedile que entre a EstuRed y lo dé desde su inicio.";

export type MinorHold = { onHold: boolean; studentProfileId: string | null; hasActiveGuardian: boolean };

export function minorHoldMessage(hold: Pick<MinorHold, "hasActiveGuardian">): string {
  return hold.hasActiveGuardian ? MINOR_ON_HOLD_LINKED_MESSAGE : MINOR_ON_HOLD_MESSAGE;
}

/** Familiares (user_id) con vínculo activo que ya dieron su consentimiento por ese perfil. */
export async function consentingGuardians(
  admin: SupabaseClient,
  studentProfileId: string,
): Promise<{ ok: true; userIds: string[]; hasActiveLink: boolean } | { ok: false }> {
  const { data: links, error: linkError } = await admin
    .from("family_links")
    .select("family_members(user_id)")
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active");
  if (linkError) {
    console.error("[minor-hold] family_links read failed:", linkError.code);
    return { ok: false };
  }
  const activeUserIds = (links ?? [])
    .map((l) => (l.family_members as unknown as { user_id: string } | null)?.user_id)
    .filter((id): id is string => Boolean(id));
  if (activeUserIds.length === 0) return { ok: true, userIds: [], hasActiveLink: false };
  const { data: consents, error: consentError } = await admin
    .from("consents")
    .select("user_id")
    .eq("consent_type", GUARDIAN_CONSENT_TYPE)
    .eq("related_entity_type", "student_profiles")
    .eq("related_entity_id", studentProfileId)
    .in("user_id", activeUserIds);
  if (consentError) {
    console.error("[minor-hold] consents read failed:", consentError.code);
    return { ok: false };
  }
  return { ok: true, userIds: [...new Set((consents ?? []).map((c) => c.user_id as string))], hasActiveLink: true };
}

/** ¿La cuenta de estudiante de este usuario está en espera? Un usuario sin perfil de estudiante (familiar, admin) nunca lo está. */
export async function loadMinorHold(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<MinorHold> {
  const { data: profile, error } = await admin.from("student_profiles").select("id, birth_date").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[minor-hold] profile read failed:", error.code);
    return { onHold: true, studentProfileId: null, hasActiveGuardian: false };
  }
  if (!profile) return { onHold: false, studentProfileId: null, hasActiveGuardian: false };
  const studentProfileId = profile.id as string;
  if (!isMinorByBirthDate(profile.birth_date as string | null, now)) return { onHold: false, studentProfileId, hasActiveGuardian: false };
  const guardians = await consentingGuardians(admin, studentProfileId);
  if (!guardians.ok) return { onHold: true, studentProfileId, hasActiveGuardian: false };
  return { onHold: guardians.userIds.length === 0, studentProfileId, hasActiveGuardian: guardians.hasActiveLink };
}

/** Atajo para las server actions: devuelve el mensaje de error si la cuenta está en espera, o `null` si puede seguir. */
export async function minorHoldError(admin: SupabaseClient, userId: string): Promise<string | null> {
  const hold = await loadMinorHold(admin, userId);
  return hold.onHold ? minorHoldMessage(hold) : null;
}

/**
 * Para acciones del FAMILIAR sobre un estudiante: ¿falta SU consentimiento? Un estudiante mayor no lo necesita. Falla cerrado.
 * El familiar tiene que dar el consentimiento antes de proponer solicitudes por un menor.
 */
export async function guardianConsentMissing(admin: SupabaseClient, studentProfileId: string, familyUserId: string, now: Date = new Date()): Promise<boolean> {
  const { data: profile, error } = await admin.from("student_profiles").select("birth_date").eq("id", studentProfileId).maybeSingle();
  if (error || !profile) return true;
  if (!isMinorByBirthDate(profile.birth_date as string | null, now)) return false;
  const guardians = await consentingGuardians(admin, studentProfileId);
  return !guardians.ok || !guardians.userIds.includes(familyUserId);
}

/** Estudiantes menores vinculados (vínculo activo) a este familiar que todavía esperan SU consentimiento. Nunca lanza. */
export async function loadPendingGuardianConsents(
  admin: SupabaseClient,
  familyUserId: string,
  now: Date = new Date(),
): Promise<{ studentProfileId: string; studentName: string }[]> {
  try {
    const { data: familyMember } = await admin.from("family_members").select("id").eq("user_id", familyUserId).maybeSingle();
    if (!familyMember) return [];
    const { data: links } = await admin
      .from("family_links")
      .select("student_profiles(id, first_name, birth_date)")
      .eq("family_member_id", familyMember.id)
      .eq("status", "active");
    const out: { studentProfileId: string; studentName: string }[] = [];
    for (const l of links ?? []) {
      const p = l.student_profiles as unknown as { id: string; first_name: string | null; birth_date: string | null } | null;
      if (!p || !isMinorByBirthDate(p.birth_date, now)) continue;
      if (await guardianConsentMissing(admin, p.id, familyUserId, now)) out.push({ studentProfileId: p.id, studentName: p.first_name?.trim() || "tu estudiante" });
    }
    return out;
  } catch (e) {
    console.error("[minor-hold] pending consents failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

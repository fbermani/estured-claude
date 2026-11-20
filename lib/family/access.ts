import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Acceso del familiar vinculado (DR4). Todo con service role y filtros explícitos: quien llama ya verificó la sesión.
 * Un familiar solo "sigue" al estudiante mientras el vínculo está `active` (docs/06 §6.4).
 */

export type FamilyMemberRow = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  relationship_type: string;
  phone: string | null;
};

/** `family_members` del usuario, o `null` si no es familiar. */
export async function loadFamilyMember(admin: SupabaseClient, userId: string): Promise<FamilyMemberRow | null> {
  const { data, error } = await admin
    .from("family_members")
    .select("id, user_id, first_name, last_name, relationship_type, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[family] no se pudo leer el familiar:", error);
    return null;
  }
  return (data as FamilyMemberRow | null) ?? null;
}

export type ActiveFamilyLink = {
  linkId: string;
  studentProfileId: string;
  permissions: Record<string, unknown>;
};

/** Vínculo ACTIVO entre el familiar (por `user_id`) y el estudiante, o `null`. */
export async function loadActiveFamilyLink(
  admin: SupabaseClient,
  familyUserId: string,
  studentProfileId: string,
): Promise<ActiveFamilyLink | null> {
  const { data, error } = await admin
    .from("family_links")
    .select("id, student_profile_id, permissions, family_members!inner(user_id)")
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active")
    .eq("family_members.user_id", familyUserId)
    .maybeSingle();
  if (error) {
    console.error("[family] no se pudo leer el vínculo:", error);
    return null;
  }
  if (!data) return null;
  return {
    linkId: data.id as string,
    studentProfileId: data.student_profile_id as string,
    permissions: (data.permissions as Record<string, unknown> | null) ?? {},
  };
}

/**
 * Familiar vinculado ACTIVO del estudiante, con lo que hace falta para designarlo pagador. `maybeSingle` es seguro porque
 * el índice único parcial `family_links_one_active_per_student` (migración 0004, docs/00 §17) garantiza a lo sumo un vínculo
 * activo por estudiante; un error de lectura se loguea y devuelve `null`.
 */
export async function loadActiveFamilyOfStudent(
  admin: SupabaseClient,
  studentProfileId: string,
): Promise<{ userId: string; name: string; permissions: Record<string, unknown> } | null> {
  const { data, error } = await admin
    .from("family_links")
    .select("permissions, family_members(user_id, first_name, last_name)")
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[family] no se pudo leer el familiar vinculado:", error);
    return null;
  }
  const member = data.family_members as unknown as { user_id: string; first_name: string; last_name: string } | null;
  if (!member) return null;
  return {
    userId: member.user_id,
    name: `${member.first_name} ${member.last_name}`.trim(),
    permissions: (data.permissions as Record<string, unknown> | null) ?? {},
  };
}

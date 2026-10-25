import { formatShortName } from "@/lib/format/shortName";
import "server-only";
import { rowCan, type ResidencePermission } from "@/lib/residences/permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Destinatarios de las notificaciones del aviso "Quiero cambiar" (DR3, Ciclo 59). Todo con service role y filtros
 * explícitos. Ante un error de lectura devuelven vacío (loggeado): una notificación que no sale nunca debe tumbar
 * la acción de negocio.
 */

/** user_id del familiar vinculado ACTIVO del estudiante (a lo sumo uno: índice único parcial de la migración 0004). */
export async function loadActiveFamilyUserIds(admin: SupabaseClient, studentProfileId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("family_links")
    .select("family_members(user_id)")
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active");
  if (error) {
    console.error("[stayChange] no se pudo leer el familiar vinculado:", error);
    return [];
  }
  return ((data ?? []) as unknown as { family_members: { user_id: string } | null }[])
    .map((row) => row.family_members?.user_id)
    .filter((id): id is string => !!id);
}

/**
 * user_id de los destinatarios de la residencia: el dueño siempre y el staff activo que tiene el permiso (DR11). Por defecto
 * `residents.manage` (responde "Quiero cambiar" y las salidas anticipadas); sin `permissions` guardado el staff falla cerrado.
 */
export async function loadResidenceUserIds(
  admin: SupabaseClient,
  residenceId: string,
  permission: ResidencePermission = "residents.manage",
): Promise<string[]> {
  const { data, error } = await admin
    .from("residence_users")
    .select("user_id, role, permissions")
    .eq("residence_id", residenceId)
    .eq("is_active", true);
  if (error) {
    console.error("[stayChange] no se pudo leer el equipo de la residencia:", error);
    return [];
  }
  const rows = (data ?? []) as { user_id: string; role: string | null; permissions: unknown }[];
  return [...new Set(rows.filter((row) => rowCan(row, permission)).map((row) => row.user_id))];
}

/** "Lucía F." — nombre corto que ya ven las residencias en sus bandejas. */
export function shortStudentName(profile: { first_name: string | null; last_initial: string | null } | null): string {
  if (!profile?.first_name) return "Un residente";
  return formatShortName(profile.first_name, profile.last_initial);
}

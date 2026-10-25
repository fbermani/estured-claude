import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  can,
  normalizeResidenceRole,
  ownerPermissions,
  OWNER_ONLY_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
  residenceActorRole,
  resolveStaffPermissions,
  type ResidenceActorRole,
  type ResidenceMembership,
  type ResidencePermission,
} from "@/lib/residences/permissions";

const NO_ACCESS_MESSAGE = "No tenés acceso a esta residencia.";
/** Cuando NO se pudo leer el vínculo (error de base): no es lo mismo que "no tenés acceso", y la persona puede reintentar. */
export const ACCESS_CHECK_FAILED_MESSAGE = "No pudimos verificar tu acceso, probá de nuevo.";

/**
 * Vínculo ACTIVO del usuario con ESTA residencia, con su rol (`owner` o `staff`) y sus permisos ya resueltos, o `null` si no tiene
 * (docs/11 §7.3: no alcanza con validar el rol general residence_owner/residence_staff — hay que validar la residencia exacta, por el
 * aislamiento multi-residencia).
 *
 * El rol y los permisos salen SIEMPRE de `residence_users` en la base (DR10/DR11), nunca de un formulario ni del rol global de la cuenta:
 * una misma persona puede ser dueña de una residencia y staff de otra, con permisos distintos en cada una. Falla cerrado: ante un error
 * de lectura devuelve `null`. El dueño trae todos los permisos; el staff, su mapa completo (`resolveStaffPermissions`).
 */
export async function getResidenceMembership(
  admin: SupabaseClient,
  userId: string,
  residenceId: string,
): Promise<ResidenceMembership | null> {
  return (await readResidenceMembership(admin, userId, residenceId)).membership;
}

/** Igual que `getResidenceMembership`, pero distingue "sin vínculo" de "no se pudo leer" (ambos fallan cerrado: `membership: null`). */
async function readResidenceMembership(
  admin: SupabaseClient,
  userId: string,
  residenceId: string,
): Promise<{ membership: ResidenceMembership | null; readFailed: boolean }> {
  const { data, error } = await admin
    .from("residence_users")
    .select("role, permissions")
    .eq("residence_id", residenceId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("[residences] membership read failed:", error.code, error.message);
    return { membership: null, readFailed: true };
  }
  if (!data) return { membership: null, readFailed: false };
  const row = data as { role?: unknown; permissions?: unknown };
  const role = normalizeResidenceRole(row.role);
  return {
    membership: { role, permissions: role === "owner" ? ownerPermissions() : resolveStaffPermissions(row.permissions) },
    readFailed: false,
  };
}

/** Tiene un vínculo activo con esta residencia (dueño o staff). Para pantallas y acciones sin casillero (ver, Soporte, avisos). */
export async function assertResidenceAccess(
  admin: SupabaseClient,
  userId: string,
  residenceId: string,
): Promise<boolean> {
  return (await getResidenceMembership(admin, userId, residenceId)) !== null;
}

export type ResidencePermissionCheck =
  | { ok: true; membership: ResidenceMembership; actorRole: ResidenceActorRole; permission: ResidencePermission }
  | { ok: false; reason: "no_access" | "check_failed" | "no_permission"; error: string };

/**
 * Exige un permiso delegable en ESTA residencia (DR11). El dueño siempre pasa; el staff solo si el dueño le encendió ese casillero.
 * Sin vínculo activo → "no tenés acceso" (mismo mensaje que el resto del área); staff sin el permiso → `PERMISSION_DENIED_MESSAGE`.
 * Si pasa, devuelve la membresía y el `actorRole` para la auditoría. El rol y los permisos se leen de la base, por residencia.
 */
export async function assertResidencePermission(
  admin: SupabaseClient,
  userId: string,
  residenceId: string,
  permission: ResidencePermission,
): Promise<ResidencePermissionCheck> {
  const { membership, readFailed } = await readResidenceMembership(admin, userId, residenceId);
  if (!membership) {
    return readFailed
      ? { ok: false, reason: "check_failed", error: ACCESS_CHECK_FAILED_MESSAGE }
      : { ok: false, reason: "no_access", error: NO_ACCESS_MESSAGE };
  }
  if (!can(membership, permission)) return { ok: false, reason: "no_permission", error: PERMISSION_DENIED_MESSAGE };
  return { ok: true, membership, actorRole: residenceActorRole(membership), permission };
}

export type ResidenceOwnerCheck =
  | { ok: true; actorRole: Extract<ResidenceActorRole, "residence_owner"> }
  | { ok: false; reason: "no_access" | "check_failed" | "owner_only"; error: string };

/**
 * Exige que el usuario sea DUEÑO de esta residencia (DR10/DR11). Para lo NO delegable: gestionar el equipo y los permisos, enviar o
 * reenviar el perfil a verificación y el reporte PDF. Sin vínculo → "no tenés acceso"; staff → `OWNER_ONLY_MESSAGE`.
 * Si pasa, devuelve el `actorRole` para la auditoría (siempre `residence_owner`).
 */
export async function assertResidenceOwner(
  admin: SupabaseClient,
  userId: string,
  residenceId: string,
): Promise<ResidenceOwnerCheck> {
  const { membership, readFailed } = await readResidenceMembership(admin, userId, residenceId);
  if (!membership) {
    return readFailed
      ? { ok: false, reason: "check_failed", error: ACCESS_CHECK_FAILED_MESSAGE }
      : { ok: false, reason: "no_access", error: NO_ACCESS_MESSAGE };
  }
  if (membership.role !== "owner") return { ok: false, reason: "owner_only", error: OWNER_ONLY_MESSAGE };
  return { ok: true, actorRole: residenceActorRole(membership) as "residence_owner" };
}

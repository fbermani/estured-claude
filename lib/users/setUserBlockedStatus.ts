import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { canBlockUser } from "@/lib/users/blockPermissions";

export type SetUserBlockedStatusResult = { status: "ok" } | { status: "error"; message: string };

/**
 * Bloquear/desbloquear un usuario (docs/06 §5.1: `users.is_blocked`, ya
 * enforced por `getSessionUser` — lib/auth/session.ts:49). Extraída como
 * Internal Action testeable, mismo patrón que el resto de las acciones
 * críticas de admin (docs/12 §5.4: toda acción admin queda auditada).
 */
export async function setUserBlockedStatus(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    /** Roles del actor leídos de la SESIÓN (nunca del formulario). */
    actorRoles: readonly string[];
    targetUserId: string;
    blocked: boolean;
    reason: string;
  },
): Promise<SetUserBlockedStatusResult> {
  const reason = params.reason.trim();
  if (params.blocked && reason.length < 5) {
    return { status: "error", message: "El motivo del bloqueo es obligatorio." };
  }

  const { data: before, error: beforeError } = await admin
    .from("users")
    .select("is_blocked, blocked_reason, primary_role")
    .eq("id", params.targetUserId)
    .maybeSingle();
  if (beforeError) {
    console.error("[users] setUserBlockedStatus read user failed:", beforeError.code, beforeError.message);
    return { status: "error", message: "No pudimos verificar los permisos. Probá de nuevo." };
  }
  if (!before) return { status: "error", message: "Usuario no encontrado." };

  // DR9: el rol del objetivo se lee de la base (primary_role + user_roles), nunca del cliente.
  // Si la lectura falla se corta: seguir solo con `primary_role` dejaría bloqueable a un administrador.
  const { data: roleRows, error: rolesError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", params.targetUserId);
  if (rolesError) {
    console.error("[users] setUserBlockedStatus read roles failed:", rolesError.code, rolesError.message);
    return { status: "error", message: "No pudimos verificar los permisos. Probá de nuevo." };
  }
  const decision = canBlockUser({
    actorUserId: params.actorUserId,
    actorRoles: params.actorRoles,
    targetUserId: params.targetUserId,
    targetRoles: [before.primary_role as string, ...(roleRows ?? []).map((r) => r.role as string)],
  });
  if (!decision.allowed) return { status: "error", message: decision.reason };

  // Orden fail-closed (sincroniza `users.is_blocked` con el ban de Supabase Auth, que corta el token ya emitido):
  // - desbloquear: primero Auth; si falla, no se toca la base y el usuario sigue bloqueado en ambos lados.
  // - bloquear: primero la base (el bloqueo ya rige en la app); si Auth falla se conserva el bloqueo y se
  //   devuelve error para que el admin reintente (la operación es idempotente).
  const banDuration = params.blocked ? "876000h" : "none";
  const banAuth = async () => {
    const { error: authError } = await admin.auth.admin.updateUserById(params.targetUserId, { ban_duration: banDuration });
    if (authError) console.error("[users] setUserBlockedStatus auth ban failed:", authError.message);
    return authError;
  };
  const AUTH_ERROR = { status: "error", message: "No pudimos actualizar el acceso del usuario. Probá de nuevo." } as const;
  if (!params.blocked && (await banAuth())) return AUTH_ERROR;

  const newValue = { is_blocked: params.blocked, blocked_reason: params.blocked ? reason : null };
  const { data: updated, error } = await admin
    .from("users")
    .update(newValue)
    .eq("id", params.targetUserId)
    .select("id");
  if (error || (updated ?? []).length === 0) {
    console.error("[users] setUserBlockedStatus failed:", error?.code, error?.message ?? "sin filas afectadas");
    return { status: "error", message: "No pudimos actualizar el usuario. Probá de nuevo." };
  }

  const blockAuthError = params.blocked ? await banAuth() : null;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRoles.includes("superadmin") ? "superadmin" : "admin",
    action: params.blocked ? "user_blocked" : "user_unblocked",
    entityType: "users",
    entityId: params.targetUserId,
    oldValue: { is_blocked: before.is_blocked, blocked_reason: before.blocked_reason },
    newValue,
    reasonText: params.blocked ? reason : undefined,
    source: "admin",
  });

  if (blockAuthError) return AUTH_ERROR;
  return { status: "ok" };
}

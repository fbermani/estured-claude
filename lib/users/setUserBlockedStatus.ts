import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

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
    actorRole: string;
    targetUserId: string;
    blocked: boolean;
    reason: string;
  },
): Promise<SetUserBlockedStatusResult> {
  if (params.targetUserId === params.actorUserId) {
    return { status: "error", message: "No podés bloquear tu propia cuenta." };
  }
  const reason = params.reason.trim();
  if (params.blocked && reason.length < 5) {
    return { status: "error", message: "El motivo del bloqueo es obligatorio." };
  }

  const { data: before } = await admin
    .from("users")
    .select("is_blocked, blocked_reason")
    .eq("id", params.targetUserId)
    .maybeSingle();
  if (!before) return { status: "error", message: "Usuario no encontrado." };

  const newValue = { is_blocked: params.blocked, blocked_reason: params.blocked ? reason : null };
  const { error } = await admin.from("users").update(newValue).eq("id", params.targetUserId);
  if (error) {
    console.error("[users] setUserBlockedStatus failed:", error.code, error.message);
    return { status: "error", message: "No pudimos actualizar el usuario. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: params.blocked ? "user_blocked" : "user_unblocked",
    entityType: "users",
    entityId: params.targetUserId,
    oldValue: before,
    newValue,
    reasonText: params.blocked ? reason : undefined,
    source: "admin",
  });

  return { status: "ok" };
}

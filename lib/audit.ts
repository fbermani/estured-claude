import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helper obligatorio de auditoría (docs/12 §5.4, docs/06 §22.1).
 * Toda server action crítica debe llamarlo. Escribe con el cliente
 * admin (audit_logs no tiene policies: solo service role).
 *
 * Nunca lanza: una falla de auditoría se loggea pero no rompe la
 * operación del usuario. (Trade-off aceptado para el MVP; revisar al
 * llegar a pagos, donde auditar es condición de la transacción.)
 */
export async function createAuditLog(
  admin: SupabaseClient,
  entry: {
    actorUserId: string | null;
    actorRole: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    reasonCode?: string;
    reasonText?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    isSystemAction?: boolean;
    source?: "user" | "admin" | "system" | "payment_provider";
  },
): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: entry.actorUserId,
    actor_role: entry.actorRole,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    reason_code: entry.reasonCode ?? null,
    reason_text: entry.reasonText ?? null,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
    is_system_action: entry.isSystemAction ?? false,
    source: entry.source ?? "user",
  });
  if (error) {
    console.error("[audit] insert failed:", error.code, error.message, entry.action);
  }
}

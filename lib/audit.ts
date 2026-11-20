import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import type { NotificationCategory } from "@/lib/notifications/categories";

/**
 * Helper obligatorio de auditoría (docs/12 §5.4, docs/06 §22.1).
 * Toda server action crítica debe llamarlo. Escribe con el cliente
 * admin (audit_logs no tiene policies: solo service role).
 *
 * Nunca lanza: una falla de auditoría se loggea pero no rompe la
 * operación del usuario (~20 call sites dependen de este comportamiento
 * default). Devuelve `true`/`false` para que los call sites de dinero
 * puedan reaccionar puntualmente — ver `alertAdminsOfAuditFailure` y su
 * uso en `recordResidencePaymentReceived`/`recordManualFeePayment`/
 * `confirmReservationAfterFeePaid` (decisión del dueño, Ciclo 35bis,
 * GAPS.md: alertar sin revertir la operación de negocio).
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
): Promise<boolean> {
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
    return false;
  }
  return true;
}

/**
 * Notifica a todos los admin/superadmin cuando un audit log de dinero
 * (pago a residencia, fee EstuRed, confirmación de reserva) falló al
 * escribirse — la operación de negocio YA se completó y no se revierte
 * (revertir dinero/reserva real sería más riesgoso que un log
 * faltante); esto es para que alguien lo revise y audite a mano.
 * Nunca lanza, mismo criterio que `createAuditLog`/`createNotification`.
 */
export async function alertAdminsOfAuditFailure(
  admin: SupabaseClient,
  params: { action: string; entityType: string; entityId: string },
): Promise<void> {
  await notifyAdmins(admin, {
    title: "Falló un registro de auditoría de dinero",
    body: `La acción "${params.action}" sobre ${params.entityType}:${params.entityId.slice(0, 8)} se completó, pero no se pudo auditar. Revisar manualmente.`,
    entityType: params.entityType,
    entityId: params.entityId,
  });
}

/**
 * Notificación genérica a todos los admin/superadmin (campana del panel). Categoría por defecto `admin_requests` (DR61): todas las alertas de
 * este helper piden revisión humana y salen también como push; pasá `category: "none"` para una que no deba salir. La usan las alertas de dinero que piden revisión humana
 * (p. ej. fee cobrado cuya reserva no se pudo confirmar, Ciclo 71 DR8). Nunca lanza.
 */
export async function notifyAdmins(
  admin: SupabaseClient,
  params: { title: string; body: string; entityType: string; entityId: string; category?: NotificationCategory },
): Promise<void> {
  const { data: admins } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "superadmin"]);
  const adminUserIds = [...new Set((admins ?? []).map((a) => a.user_id))];
  await Promise.all(
    adminUserIds.map((userId) =>
      createNotification(admin, {
        userId,
        title: params.title,
        body: params.body,
        relatedEntityType: params.entityType,
        relatedEntityId: params.entityId,
        category: params.category ?? "admin_requests",
      }),
    ),
  );
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

const PENDING_FEE_STATUSES = ["pending_payment_method", "pending_manual_payment", "pending_auto_charge", "processing"];

/**
 * Job `expire_estured_fee_windows` (docs/07 §17.2, §31) — cada hora.
 * Fees sin pagar dentro de la ventana pasan a `expired` (terminal) y la
 * reserva asociada a `expired_fee_unpaid`. No cuenta "hasta 3 intentos"
 * (docs/07 §17.2) porque hoy no hay cobro automático real que reintente
 * — el modo manual (Ciclo 11) no genera intentos fallidos que contar,
 * así que cualquier fee pendiente que venza expira directamente. Sin
 * notificación real (pendiente, docs/00 §29).
 */
export async function expireEsturedFeeWindows(admin: SupabaseClient): Promise<{ expiredCount: number }> {
  const { data: staleFees, error } = await admin
    .from("estured_fee_payments")
    .update({ status: "expired" })
    .in("status", PENDING_FEE_STATUSES)
    .lt("expires_at", new Date().toISOString())
    .select("id, reservation_id");

  if (error) {
    console.error("[jobs] expireEsturedFeeWindows failed:", error);
    return { expiredCount: 0 };
  }

  let expiredCount = 0;
  for (const fee of staleFees ?? []) {
    if (fee.reservation_id) {
      await admin
        .from("reservations")
        .update({ status: "expired_fee_unpaid" })
        .eq("id", fee.reservation_id)
        .eq("status", "pending_estured_fee");
    }
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "estured_fee_expired",
      entityType: "estured_fee_payments",
      entityId: fee.id,
      newValue: { reservation_id: fee.reservation_id },
      source: "system",
    });
    expiredCount += 1;
  }

  return { expiredCount };
}

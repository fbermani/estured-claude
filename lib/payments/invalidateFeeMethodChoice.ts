import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyFeePayer } from "@/lib/payments/feePayerNotices";

/**
 * Invalida el medio ya elegido (y congelado) por los pagadores cuando el superadmin deshabilita o cambia ese medio de cobro del fee
 * (DR64 (a) y (b)). Solo fees en `pending_payment_method`: uno en `pending_manual_payment` ya informó el pago con los datos que vio.
 * Vuelve `chosen_method` e `instructions_snapshot` a null y `payment_currency` a su valor por defecto (`'ARS'`, la columna es NOT NULL),
 * así el pagador vuelve a elegir y no puede informar un pago a un medio que EstuRed ya no ofrece o con datos de cobro viejos.
 * `fee_amount_usd` no se toca: se recalcula al elegir de nuevo. Avisa en la app a cada pagador, sin datos de cobro. Nunca lanza.
 * Devuelve cuántos fees invalidó (`-1` si no pudo).
 */
export async function invalidateFeeMethodChoice(admin: SupabaseClient, methodKey: string): Promise<number> {
  try {
    const { data, error } = await admin
      .from("estured_fee_payments")
      .update({ chosen_method: null, instructions_snapshot: null, payment_currency: "ARS" })
      .eq("status", "pending_payment_method")
      .eq("chosen_method", methodKey)
      .select("id, payer_user_id, reservation_id");
    if (error) {
      console.error("[fee-collection] invalidate chosen method failed:", error.code, error.message);
      return -1;
    }
    const rows = (data ?? []) as { id: string; payer_user_id: string | null; reservation_id: string | null }[];
    for (const row of rows) {
      if (!row.payer_user_id || !row.reservation_id) continue;
      await notifyFeePayer(admin, { payerUserId: row.payer_user_id, kind: "method_unavailable", related: { type: "reservations", id: row.reservation_id } });
    }
    return rows.length;
  } catch (error) {
    console.error("[fee-collection] invalidate chosen method threw:", error);
    return -1;
  }
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withEmptyMonthColumns } from "@/lib/applications/snapshotColumns";
import type { ReceiptPayload, ReceiptSupplement } from "@/lib/receipts/receiptView";

/**
 * Completa el contenido de un comprobante con lo que el `receipt_payload` no
 * guardó (H07): comprobantes emitidos antes de que se congelara el monto
 * informado por la residencia, y el familiar pagador (docs/01 §14).
 *
 * Se llama DESPUÉS de haber leído el comprobante con el cliente del usuario
 * (RLS ya validó que puede verlo). `userClient` lee el pago a la residencia
 * con las mismas policies; `admin` se usa solo para una proyección mínima
 * (`student_profiles.user_id`) con la que decidir si quien pagó es el
 * estudiante o un familiar. Cualquier fallo devuelve un suplemento vacío:
 * el comprobante se muestra igual, solo sin esas filas.
 */
export async function loadReceiptSupplement(
  userClient: SupabaseClient,
  admin: SupabaseClient | null,
  receipt: {
    reservation_id: string | null;
    student_profile_id: string | null;
    payer_user_id: string | null;
    receipt_payload: unknown;
  },
): Promise<ReceiptSupplement> {
  const payload = (receipt.receipt_payload ?? {}) as ReceiptPayload;
  const supplement: ReceiptSupplement = {};

  const hasInformed =
    payload.residence_payment?.amount_usd != null || payload.residence_payment?.amount_ars != null;
  if (receipt.reservation_id) {
    const { data: reservation, error: reservationError } = await userClient
      .from("reservations")
      .select("snapshot_id, external_residence_payment_id")
      .eq("id", receipt.reservation_id)
      .maybeSingle();
    if (reservationError) console.error("[receipt-supplement] reservations query failed:", reservationError.code, reservationError.message);

    // Condiciones del snapshot (inmutable): completan lo que un comprobante viejo no guardó.
    if (reservation?.snapshot_id) {
      const { data: snapshot, error: snapshotError } = await withEmptyMonthColumns<Record<string, unknown>>(
        "monthly_price_usd, monthly_price_ars, enrollment_fee_usd, enrollment_fee_ars, deposit_usd, deposit_ars, exchange_rate_ars_per_usd, exchange_rate_date, adjustment_policy",
        (columns) =>
          userClient
            .from("application_snapshots")
            .select(columns)
            .eq("id", reservation.snapshot_id as string)
            .maybeSingle() as unknown as PromiseLike<{ data: Record<string, unknown> | null; error: { code?: string | null; message?: string | null } | null }>,
      );
      if (snapshotError) console.error("[receipt-supplement] application_snapshots query failed:", snapshotError.code, snapshotError.message);
      if (snapshot) supplement.snapshot = snapshot as ReceiptSupplement["snapshot"];
    }

    // Monto informado por la residencia: solo si el comprobante viejo no lo trae.
    if (!hasInformed && reservation?.external_residence_payment_id) {
      const { data: payment, error: paymentError } = await userClient
        .from("external_residence_payments")
        .select("amount_reported_usd, amount_reported_ars")
        .eq("id", reservation.external_residence_payment_id as string)
        .maybeSingle();
      if (paymentError) console.error("[receipt-supplement] external_residence_payments query failed:", paymentError.code, paymentError.message);
      if (payment && (payment.amount_reported_usd !== null || payment.amount_reported_ars !== null)) {
        supplement.residencePayment = {
          usd: payment.amount_reported_usd !== null ? Number(payment.amount_reported_usd) : null,
          ars: payment.amount_reported_ars !== null ? Number(payment.amount_reported_ars) : null,
        };
      }
    }
  }

  // Familiar pagador: el que pagó el fee no es el dueño del perfil de estudiante.
  const payerName = payload.estured_fee?.payer_billing_name?.trim();
  if (admin && receipt.payer_user_id && receipt.student_profile_id && payerName) {
    const { data: student, error: studentError } = await admin
      .from("student_profiles")
      .select("user_id")
      .eq("id", receipt.student_profile_id)
      .maybeSingle();
    if (studentError) console.error("[receipt-supplement] student_profiles query failed:", studentError.code, studentError.message);
    if (student && student.user_id !== receipt.payer_user_id) supplement.familyPayerName = payerName;
  }

  return supplement;
}

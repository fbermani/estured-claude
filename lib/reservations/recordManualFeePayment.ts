import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { confirmReservationAfterFeePaid } from "@/lib/reservations/confirmAfterFeePaid";

export type RecordManualFeePaymentResult = { ok: true } | { ok: false; error: string };

const VALIDATABLE_STATUSES = ["pending_payment_method", "pending_manual_payment"];

/**
 * Docs/07 §17.4 — admin valida un pago manual del fee EstuRed. Motivo
 * obligatorio (queda auditado). Dispara la confirmación de reserva +
 * generación de comprobante en la misma operación (docs/07 §18.2), vía
 * `confirmReservationAfterFeePaid`.
 *
 * Extraído del server action (Ciclo 19, GAPS.md — gap de arquitectura
 * detectado en el Ciclo 14) para que la lógica de negocio, incluida la
 * validación server-side, sea testeable sin `next/headers`: recibe todo
 * por parámetro. El server action solo resuelve sesión, parsea
 * `FormData` y llama a esta función.
 */
export async function recordManualFeePayment(
  admin: SupabaseClient,
  params: {
    feePaymentId: string;
    reason: string;
    paymentCurrency: string;
    providerReference: string | null;
    actorUserId: string;
    actorRole: "admin" | "superadmin";
  },
): Promise<RecordManualFeePaymentResult> {
  if (params.reason.length < 5) return { ok: false, error: "Escribí un motivo para que quede registrado." };
  if (!["ARS", "USD"].includes(params.paymentCurrency)) return { ok: false, error: "Moneda inválida." };

  const { data: feePayment } = await admin
    .from("estured_fee_payments")
    .select("id, status")
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (!feePayment) return { ok: false, error: "No encontramos ese pago." };
  if (!VALIDATABLE_STATUSES.includes(feePayment.status)) {
    return { ok: false, error: "Ese pago ya no está pendiente de validación." };
  }

  const now = new Date();

  const { error: updateError } = await admin
    .from("estured_fee_payments")
    .update({
      status: "paid",
      payment_provider: "manual",
      payment_currency: params.paymentCurrency,
      provider_payment_id: params.providerReference,
      paid_at: now.toISOString(),
    })
    .eq("id", params.feePaymentId);
  if (updateError) {
    console.error("[admin-payments] mark-paid failed:", updateError);
    return { ok: false, error: "No pudimos guardar el pago." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "estured_fee_marked_paid_manually",
    entityType: "estured_fee_payments",
    entityId: params.feePaymentId,
    reasonText: params.reason,
    source: "admin",
  });

  const result = await confirmReservationAfterFeePaid(admin, {
    feePaymentId: params.feePaymentId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
  });
  if (!result.ok) {
    console.error("[admin-payments] confirmReservationAfterFeePaid failed:", result.error);
    return { ok: false, error: `Pago marcado, pero falló la confirmación de la reserva: ${result.error}` };
  }

  return { ok: true };
}

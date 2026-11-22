import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { confirmRenewalAfterFeePaid } from "@/lib/renewals/confirmRenewalAfterFeePaid";

export type RecordRenewalManualFeePaymentResult = { ok: true } | { ok: false; error: string };

const VALIDATABLE_STATUSES = ["pending_payment_method", "pending_manual_payment"];

/**
 * Docs/07 §17.4 — admin valida un pago manual del fee EstuRed de una
 * renovación. Mismo patrón que `recordManualFeePayment` de la reserva
 * inicial: motivo obligatorio, dispara `confirmRenewalAfterFeePaid` en
 * la misma operación.
 */
export async function recordRenewalManualFeePayment(
  admin: SupabaseClient,
  params: {
    feePaymentId: string;
    reason: string;
    paymentCurrency: string;
    providerReference: string | null;
    actorUserId: string;
    actorRole: "admin" | "superadmin";
  },
): Promise<RecordRenewalManualFeePaymentResult> {
  if (params.reason.length < 5) return { ok: false, error: "Escribí un motivo para que quede registrado." };
  if (!["ARS", "USD"].includes(params.paymentCurrency)) return { ok: false, error: "Moneda inválida." };

  const { data: feePayment } = await admin
    .from("estured_fee_payments")
    .select("id, status, renewal_offer_id, expires_at")
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (!feePayment) return { ok: false, error: "No encontramos ese pago." };
  if (!feePayment.renewal_offer_id) return { ok: false, error: "Ese pago no corresponde a una renovación." };
  if (!VALIDATABLE_STATUSES.includes(feePayment.status)) {
    return { ok: false, error: "Ese pago ya no está pendiente de validación." };
  }

  // SEG14-01: un fee vencido no se marca pagado (docs/04 §17: primero se reabre el plazo). DR64 (d): en `pending_manual_payment`
  // el pago ya se informó a tiempo y no vence: el plazo solo se exige en `pending_payment_method`.
  if (feePayment.status === "pending_payment_method" && feePayment.expires_at && new Date(feePayment.expires_at) <= new Date()) {
    return { ok: false, error: "El plazo de este pago venció: reabrilo antes de validarlo." };
  }

  const now = new Date();

  const { data: updatedRows, error: updateError } = await admin
    .from("estured_fee_payments")
    .update({
      status: "paid",
      payment_provider: "manual",
      payment_currency: params.paymentCurrency,
      provider_payment_id: params.providerReference,
      paid_at: now.toISOString(),
    })
    .eq("id", params.feePaymentId)
    .eq("status", feePayment.status)
    .select("id");
  if (updateError) {
    console.error("[renewals] mark-paid failed:", updateError);
    return { ok: false, error: "No pudimos guardar el pago." };
  }
  if (!updatedRows || updatedRows.length === 0) return { ok: false, error: "Ese pago ya no está pendiente de validación." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "renewal_fee_marked_paid_manually",
    entityType: "estured_fee_payments",
    entityId: params.feePaymentId,
    reasonText: params.reason,
    source: "admin",
  });

  const result = await confirmRenewalAfterFeePaid(admin, {
    feePaymentId: params.feePaymentId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
  });
  if (!result.ok) {
    console.error("[renewals] confirmRenewalAfterFeePaid failed:", result.error);
    return { ok: false, error: `Pago marcado, pero falló la confirmación de la renovación: ${result.error}` };
  }

  return { ok: true };
}

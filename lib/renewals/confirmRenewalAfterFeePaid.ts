import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

type ConfirmRenewalResult =
  | { ok: true; renewalOfferId: string; receiptId: string; verificationCode: string }
  | { ok: false; error: string };

/**
 * Docs/07 §18.1-19.1, docs/12 §13.2 — "Internal Action" invocada al
 * validar el fee de una renovación (admin, manual). Mismo patrón que
 * `confirmReservationAfterFeePaid`, con las mismas dos diferencias
 * deliberadas que `recordRenewalResidencePaymentReceived`: no crea una
 * `reservations` nueva, no descuenta `profile_availability` (el
 * estudiante ya ocupa la plaza). Genera "Comprobante de Renovación
 * Confirmada" en `renewal_receipts` (migración 0016). Factura C real
 * queda `pending_issue`, igual que en la reserva inicial — bloqueada
 * por credenciales de TusFacturas.app, no por este código.
 */
export async function confirmRenewalAfterFeePaid(
  admin: SupabaseClient,
  params: { feePaymentId: string; actorUserId: string | null; actorRole: string },
): Promise<ConfirmRenewalResult> {
  const { data: feePayment } = await admin
    .from("estured_fee_payments")
    .select("id, status, renewal_offer_id, payer_user_id")
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (!feePayment || !feePayment.renewal_offer_id) {
    return { ok: false, error: "No encontramos el pago del fee de renovación." };
  }

  const { data: offer } = await admin
    .from("renewal_offers")
    .select(
      "id, status, reservation_id, student_profile_id, residence_id, period_start_date, period_end_date, duration_months, monthly_price_usd, monthly_price_ars, adjustment_policy, external_residence_payment_id",
    )
    .eq("id", feePayment.renewal_offer_id)
    .single();
  if (!offer) return { ok: false, error: "No encontramos la oferta de renovación asociada." };

  const { data: residencePayment } = await admin
    .from("external_residence_payments")
    .select("status")
    .eq("id", offer.external_residence_payment_id)
    .single();
  if (residencePayment?.status !== "reported_received_by_residence") {
    return { ok: false, error: "El pago a la residencia todavía no fue confirmado." };
  }

  const now = new Date();

  const { error: offerError } = await admin
    .from("renewal_offers")
    .update({ status: "confirmed" })
    .eq("id", offer.id);
  if (offerError) return { ok: false, error: "No pudimos confirmar la renovación." };

  const [{ data: student }, { data: residence }, { data: payerUser }, { data: fullFeePayment }] = await Promise.all([
    admin
      .from("student_profiles")
      .select("first_name, last_initial")
      .eq("id", offer.student_profile_id)
      .single(),
    admin.from("residences").select("name, public_area").eq("id", offer.residence_id).single(),
    admin.from("users").select("email").eq("id", feePayment.payer_user_id).maybeSingle(),
    admin
      .from("estured_fee_payments")
      .select(
        "fee_amount_ars, fee_amount_usd, payment_currency, payer_billing_name, payer_billing_cuit, payer_iva_condition, paid_at",
      )
      .eq("id", feePayment.id)
      .single(),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verificationCode = crypto.randomUUID();
  const receiptNumber = `ERR-${now.getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const receiptPayload = {
    renewal_offer_id: offer.id,
    reservation_id: offer.reservation_id,
    issued_at: now.toISOString(),
    student: { first_name: student?.first_name, last_initial: student?.last_initial },
    residence: { name: residence?.name, public_area: residence?.public_area },
    period_start_date: offer.period_start_date,
    period_end_date: offer.period_end_date,
    duration_months: offer.duration_months,
    monthly_price_usd: offer.monthly_price_usd,
    monthly_price_ars: offer.monthly_price_ars,
    adjustment_policy: offer.adjustment_policy,
    residence_payment_confirmed: true,
    estured_fee: {
      amount_ars: fullFeePayment?.fee_amount_ars,
      amount_usd: fullFeePayment?.fee_amount_usd,
      currency: fullFeePayment?.payment_currency,
      paid_at: fullFeePayment?.paid_at,
      payer_billing_name: fullFeePayment?.payer_billing_name,
      payer_billing_cuit: fullFeePayment?.payer_billing_cuit,
      payer_iva_condition: fullFeePayment?.payer_iva_condition,
      payer_email: payerUser?.email,
    },
    disclaimer:
      "EstuRed es una plataforma intermediaria de búsqueda, solicitud, registro y comprobante. No presta directamente el alojamiento ni garantiza la conducta de las partes.",
  };

  const { data: receipt, error: receiptError } = await admin
    .from("renewal_receipts")
    .insert({
      renewal_offer_id: offer.id,
      status: "issued",
      receipt_number: receiptNumber,
      verification_code: verificationCode,
      qr_code_value: `${appUrl}/verify/${verificationCode}`,
      issued_at: now.toISOString(),
      receipt_payload: receiptPayload,
    })
    .select("id")
    .single();
  if (receiptError || !receipt) {
    console.error("[renewals] renewal_receipts insert failed:", receiptError);
    // Docs/07 §19.1 (mismo criterio que la reserva inicial): si falla el
    // comprobante, la renovación sigue confirmed — no se revierte.
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "renewal_receipt_generation_failed",
      entityType: "renewal_offers",
      entityId: offer.id,
      source: "system",
    });
    return { ok: true, renewalOfferId: offer.id, receiptId: "", verificationCode: "" };
  }

  await admin.from("renewal_offers").update({ renewal_receipt_id: receipt.id }).eq("id", offer.id);
  await admin.from("estured_fee_payments").update({ fiscal_invoice_status: "pending_issue" }).eq("id", feePayment.id);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "renewal_confirmed",
    entityType: "renewal_offers",
    entityId: offer.id,
    newValue: { renewal_receipt_id: receipt.id, verification_code: verificationCode },
    source: params.actorRole === "admin" || params.actorRole === "superadmin" ? "admin" : "system",
  });

  return { ok: true, renewalOfferId: offer.id, receiptId: receipt.id, verificationCode };
}

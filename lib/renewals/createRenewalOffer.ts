import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidenceAccess } from "@/lib/residences/access";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";

export type CreateRenewalOfferResult = { ok: true; renewalOfferId: string } | { ok: false; error: string };

const ADJUSTMENT_POLICIES = new Set(["monthly", "quarterly", "semiannual", "annual", "none"]);

/**
 * Docs/12 §13.1-13.2, docs/05 §14 (`residence_owner`/`residence_staff`
 * con acceso a la residencia). La oferta puede guardarse como
 * `draft` (editable, no visible para el estudiante) o enviarse
 * directamente (`sendNow: true` → `sent`) — mismo patrón de dos
 * acciones que la referencia de diseño (`design-references/...
 * estured_admin_modal_ofrecer_renovaci_u00f3n`, inspiración visual,
 * no spec).
 *
 * Fórmula del fee: idéntica a la reserva inicial, sin excepciones
 * (docs/03 §16.5) — reusa `calculateFeeEstimate` tal cual, sin
 * reimplementar. El tipo de cambio se resuelve al momento de crear la
 * oferta (no hay columna de exchange_rate en `renewal_offers` per
 * docs/06 §14.2 — a diferencia de `application_snapshots`, que sí la
 * tiene; se guardan ambos montos USD/ARS ya convertidos, sin la tasa
 * en sí, siguiendo el schema documentado literal).
 */
export async function createRenewalOffer(
  admin: SupabaseClient,
  params: {
    reservationId: string;
    renewalRequestId: string | null;
    actorUserId: string;
    periodStartDate: string;
    durationMonths: number;
    monthlyPriceUsd: number;
    enrollmentOrRenewalFeeUsd: number | null;
    depositUsd: number | null;
    adjustmentPolicy: string;
    acceptanceDeadlineAt: string;
    sendNow: boolean;
  },
): Promise<CreateRenewalOfferResult> {
  if (params.durationMonths <= 0) return { ok: false, error: "La duración debe ser mayor a cero." };
  if (params.monthlyPriceUsd <= 0) return { ok: false, error: "La tarifa mensual debe ser mayor a cero." };
  if (!ADJUSTMENT_POLICIES.has(params.adjustmentPolicy)) {
    return { ok: false, error: "Política de ajuste inválida." };
  }
  if (new Date(params.acceptanceDeadlineAt) <= new Date()) {
    return { ok: false, error: "La fecha límite debe ser futura." };
  }

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, student_profile_id, residence_id")
    .eq("id", params.reservationId)
    .maybeSingle();
  if (!reservation) return { ok: false, error: "No encontramos esa reserva." };
  if (reservation.status !== "confirmed") {
    return { ok: false, error: "Solo se puede ofrecer renovación de una reserva confirmada." };
  }

  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, reservation.residence_id);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };

  const rate = await getCurrentExchangeRate();
  const monthlyPriceArs = params.monthlyPriceUsd * rate.arsPerUsd;
  const enrollmentFeeArs = params.enrollmentOrRenewalFeeUsd ? params.enrollmentOrRenewalFeeUsd * rate.arsPerUsd : null;
  const depositArs = params.depositUsd ? params.depositUsd * rate.arsPerUsd : null;

  const fee = calculateFeeEstimate({
    monthlyPriceUsd: params.monthlyPriceUsd,
    durationMonths: params.durationMonths,
    enrollmentFeeUsd: params.enrollmentOrRenewalFeeUsd,
    arsPerUsd: rate.arsPerUsd,
  });

  const periodStart = new Date(params.periodStartDate);
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + params.durationMonths);

  const status = params.sendNow ? "sent" : "draft";

  const { data: offer, error } = await admin
    .from("renewal_offers")
    .insert({
      reservation_id: reservation.id,
      renewal_request_id: params.renewalRequestId,
      student_profile_id: reservation.student_profile_id,
      residence_id: reservation.residence_id,
      status,
      period_start_date: params.periodStartDate,
      period_end_date: periodEnd.toISOString().slice(0, 10),
      duration_months: params.durationMonths,
      monthly_price_usd: params.monthlyPriceUsd,
      monthly_price_ars: monthlyPriceArs,
      enrollment_or_renewal_fee_usd: params.enrollmentOrRenewalFeeUsd,
      enrollment_or_renewal_fee_ars: enrollmentFeeArs,
      deposit_usd: params.depositUsd,
      deposit_ars: depositArs,
      adjustment_policy: params.adjustmentPolicy,
      fee_base_usd: fee.feeBaseUsd,
      fee_base_ars: fee.feeBaseArs,
      estimated_estured_fee_ars: fee.estimatedFeeArs,
      acceptance_deadline_at: params.acceptanceDeadlineAt,
      sent_by_user_id: params.sendNow ? params.actorUserId : null,
    })
    .select("id")
    .single();
  if (error || !offer) {
    console.error("[renewals] createRenewalOffer insert failed:", error);
    return { ok: false, error: "No pudimos crear la oferta. Intentá de nuevo." };
  }

  if (params.renewalRequestId && params.sendNow) {
    await admin.from("renewal_requests").update({ status: "offer_received" }).eq("id", params.renewalRequestId);
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "residence_owner",
    action: params.sendNow ? "renewal_offer_sent" : "renewal_offer_draft_saved",
    entityType: "renewal_offers",
    entityId: offer.id,
    newValue: { status, duration_months: params.durationMonths, monthly_price_usd: params.monthlyPriceUsd },
    source: "user",
  });

  return { ok: true, renewalOfferId: offer.id };
}

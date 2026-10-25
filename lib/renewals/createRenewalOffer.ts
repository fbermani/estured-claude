import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";

export type CreateRenewalOfferResult = { ok: true; renewalOfferId: string } | { ok: false; error: string };

/**
 * Estados de una `renewal_request` en los que todavía se le puede responder con una oferta (docs/06 §14.1, enum `renewal_request_status`
 * de la 0016). Las demás (`offer_received`, `closed_no_offer`, `superseded_by_offer`) ya están resueltas.
 */
export const OFFERABLE_RENEWAL_REQUEST_STATUSES = ["created_by_student", "notified_to_residence"] as const;
const RENEWAL_REQUEST_UNAVAILABLE = "Esa solicitud de renovación ya no está disponible. Actualizá la página.";

/** Mensaje cuando quien ofrece la renovación solo tiene `renewals.manage` y cambia el precio, la matrícula o el depósito vigentes. */
export const RENEWAL_CONDITIONS_PERMISSION_MESSAGE =
  "Cambiar el precio, la matrícula o el depósito de la renovación requiere el permiso de Proponer un ajuste de condiciones. Pedíselo al dueño.";

const sameUsd = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);

/**
 * ¿La oferta cambia las condiciones vigentes de la reserva? Las vigentes son las del snapshot de la reserva (lo que se acordó al reservar:
 * tarifa mensual, matrícula y depósito). El precio tiene que ser igual; la matrícula o el depósito, si la oferta trae un monto, también
 * (no cobrar matrícula ni depósito en la renovación no es "fijar" nada, así que `null`/0 no cuentan como cambio). Si no se pueden leer las
 * condiciones vigentes se asume que cambian (falla cerrado: solo pasa quien puede proponer ajustes).
 */
async function offerChangesCurrentConditions(
  admin: SupabaseClient,
  snapshotId: string | null,
  offered: { monthlyPriceUsd: number; enrollmentOrRenewalFeeUsd: number | null; depositUsd: number | null },
): Promise<boolean> {
  if (!snapshotId) return true;
  const { data: snapshot, error } = await admin
    .from("application_snapshots")
    .select("monthly_price_usd, enrollment_fee_usd, deposit_usd")
    .eq("id", snapshotId)
    .maybeSingle();
  if (error || !snapshot) return true;
  if (!sameUsd(offered.monthlyPriceUsd, Number(snapshot.monthly_price_usd))) return true;
  const sameOrNone = (offeredUsd: number | null, currentUsd: unknown) =>
    !offeredUsd || (currentUsd != null && sameUsd(offeredUsd, Number(currentUsd)));
  return !sameOrNone(offered.enrollmentOrRenewalFeeUsd, snapshot.enrollment_fee_usd) || !sameOrNone(offered.depositUsd, snapshot.deposit_usd);
}

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
    .select("id, status, student_profile_id, residence_id, snapshot_id")
    .eq("id", params.reservationId)
    .maybeSingle();
  if (!reservation) return { ok: false, error: "No encontramos esa reserva." };
  if (reservation.status !== "confirmed") {
    return { ok: false, error: "Solo se puede ofrecer renovación de una reserva confirmada." };
  }

  const access = await assertResidencePermission(admin, params.actorUserId, reservation.residence_id, "renewals.manage");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;

  // `renewals.manage` crea ofertas que MANTIENEN las condiciones vigentes. Si el precio, la matrícula o el depósito cambian, es una propuesta
  // de ajuste y exige además `applications.send_adjustment` (apagado por defecto para el staff; el dueño siempre puede, sin consultar nada).
  const mayChangeConditions = can(access.membership, "applications.send_adjustment");
  if (!mayChangeConditions) {
    const changes = await offerChangesCurrentConditions(admin, (reservation.snapshot_id as string | null) ?? null, {
      monthlyPriceUsd: params.monthlyPriceUsd,
      enrollmentOrRenewalFeeUsd: params.enrollmentOrRenewalFeeUsd,
      depositUsd: params.depositUsd,
    });
    if (changes) return { ok: false, error: RENEWAL_CONDITIONS_PERMISSION_MESSAGE };
  }

  // IDOR: `renewalRequestId` viaja del cliente. Tiene que ser una solicitud de ESTA reserva y estar todavía abierta; si no, se rechaza
  // (no se acepta el id de una solicitud ajena, de otra reserva, ya resuelta o cancelada).
  if (params.renewalRequestId) {
    const { data: renewalRequest, error: requestError } = await admin
      .from("renewal_requests")
      .select("id")
      .eq("id", params.renewalRequestId)
      .eq("reservation_id", reservation.id)
      .in("status", [...OFFERABLE_RENEWAL_REQUEST_STATUSES])
      .maybeSingle();
    if (requestError) {
      console.error("[renewals] createRenewalOffer request read failed:", requestError);
      return { ok: false, error: "No pudimos crear la oferta. Intentá de nuevo." };
    }
    if (!renewalRequest) return { ok: false, error: RENEWAL_REQUEST_UNAVAILABLE };
  }

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
    // Update condicional por reserva y estado, con chequeo de filas: si otro actor la movió entre el chequeo y acá, se deshace la oferta
    // recién creada (todavía sin dependientes) en vez de dejar una oferta enviada contra una solicitud que ya no estaba abierta.
    const { data: movedRows, error: moveError } = await admin
      .from("renewal_requests")
      .update({ status: "offer_received" })
      .eq("id", params.renewalRequestId)
      .eq("reservation_id", reservation.id)
      .in("status", [...OFFERABLE_RENEWAL_REQUEST_STATUSES])
      .select("id");
    if (moveError || !movedRows || movedRows.length === 0) {
      if (moveError) console.error("[renewals] createRenewalOffer request update failed:", moveError);
      await admin.from("renewal_offers").delete().eq("id", offer.id).eq("status", status);
      return { ok: false, error: moveError ? "No pudimos crear la oferta. Intentá de nuevo." : RENEWAL_REQUEST_UNAVAILABLE };
    }
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: params.sendNow ? "renewal_offer_sent" : "renewal_offer_draft_saved",
    entityType: "renewal_offers",
    entityId: offer.id,
    newValue: { permission: access.permission, status, duration_months: params.durationMonths, monthly_price_usd: params.monthlyPriceUsd },
    source: "user",
  });

  return { ok: true, renewalOfferId: offer.id };
}

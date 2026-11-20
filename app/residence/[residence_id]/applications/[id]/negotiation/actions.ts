"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidencePermission } from "@/lib/residences/access";
import { assertRegulationAccepted } from "@/lib/regulations/gate";
import { createAuditLog } from "@/lib/audit";
import { usdToArs } from "@/lib/mock/exchange";
import {
  MAX_ADJUSTMENT_POLICY,
  MAX_APPLICATION_TEXT,
  checkTextMax,
  isIsoDate,
} from "@/lib/applications/inputLimits";

export type SendProposalState = { status: "idle" | "error"; message?: string };

const MAX_USD = 100_000;

type NumResult = { ok: true; value: number | null } | { ok: false };

/** Número opcional: vacío -> null; si viene, debe ser finito, ≤ tope y > 0 (o ≥ 0 con `allowZero`). */
function parseAmount(formData: FormData, key: string, opts: { allowZero: boolean; max: number; integer?: boolean }): NumResult {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n > opts.max) return { ok: false };
  if (opts.allowZero ? n < 0 : n <= 0) return { ok: false };
  if (opts.integer && !Number.isInteger(n)) return { ok: false };
  return { ok: true, value: n };
}

/**
 * Enviar propuesta de ajuste (docs/07 §15.4, docs/03 §10ter.2-3).
 * Máximo 1 por solicitud — el sistema lo bloquea con el `unique` de la
 * migración 0008 además de esta validación explícita.
 */
export async function sendNegotiationProposal(
  applicationId: string,
  _prev: SendProposalState,
  formData: FormData,
): Promise<SendProposalState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: application } = await admin
    .from("application_requests")
    .select("id, status, residence_id, proposal_count, snapshot_original_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { status: "error", message: "No encontramos esa solicitud." };

  // DR11: la propuesta de ajuste de condiciones (precio, matrícula, depósito, fechas) requiere el permiso `applications.send_adjustment`
  // (apagado por defecto para el staff; el dueño siempre puede). Se autoriza ANTES de leer nada más (ni el snapshot de la solicitud).
  const access = await assertResidencePermission(admin, sessionUser.id, application.residence_id, "applications.send_adjustment");
  if (!access.ok) return { status: "error", message: access.error };
  // DR14: sin la aceptación del reglamento por parte del estudiante la solicitud no avanza.
  const regulationGate = await assertRegulationAccepted(admin, applicationId);
  if (!regulationGate.ok) return { status: "error", message: regulationGate.error };

  // Docs/06 §11.2: la ARS de la propuesta usa la cotización de la
  // solicitud original — nunca la del día en que se envía la propuesta.
  const { data: originalSnapshot } = await admin
    .from("application_snapshots")
    .select("exchange_rate_ars_per_usd")
    .eq("id", application.snapshot_original_id)
    .single();
  if (!originalSnapshot) return { status: "error", message: "No encontramos el snapshot original." };
  const arsPerUsd = Number(originalSnapshot.exchange_rate_ars_per_usd);

  if (application.status !== "contact_established") {
    return { status: "error", message: "Solo podés proponer un ajuste después de establecer contacto." };
  }
  if (application.proposal_count > 0) {
    return { status: "error", message: "Ya enviaste tu única propuesta de ajuste para esta solicitud." };
  }
  if (formData.get("warning_acknowledged") !== "on") {
    return { status: "error", message: "Tenés que confirmar que leíste la advertencia." };
  }

  const usd = { allowZero: false, max: MAX_USD };
  const usdOrZero = { allowZero: true, max: MAX_USD };
  const monthly = parseAmount(formData, "proposed_monthly_price_usd", usd);
  const enrollment = parseAmount(formData, "proposed_enrollment_fee_usd", usdOrZero);
  const deposit = parseAmount(formData, "proposed_deposit_usd", usdOrZero);
  const duration = parseAmount(formData, "proposed_duration_months", { allowZero: false, max: 24, integer: true });
  const reservation = parseAmount(formData, "proposed_reservation_payment_amount_usd", usdOrZero);
  const startDateRaw = String(formData.get("proposed_start_date") ?? "").trim();
  if (!monthly.ok) return { status: "error", message: "El precio mensual tiene que ser un monto mayor a 0 (hasta USD 100.000)." };
  if (!enrollment.ok) return { status: "error", message: "La matrícula tiene que ser un monto de 0 o más (hasta USD 100.000)." };
  if (!deposit.ok) return { status: "error", message: "El depósito tiene que ser un monto de 0 o más (hasta USD 100.000)." };
  if (!reservation.ok) return { status: "error", message: "El pago de reserva tiene que ser un monto de 0 o más (hasta USD 100.000)." };
  if (!duration.ok) return { status: "error", message: "La duración tiene que ser un número entero de meses entre 1 y 24." };
  if (startDateRaw && !isIsoDate(startDateRaw)) return { status: "error", message: "La fecha de inicio no es válida." };
  const monthlyPriceUsd = monthly.value;
  const enrollmentFeeUsd = enrollment.value;
  const depositUsd = deposit.value;
  const startDate = startDateRaw || null;
  const durationMonths = duration.value;
  const adjustmentPolicy = String(formData.get("proposed_adjustment_policy") ?? "").trim() || null;
  const reservationAmountUsd = reservation.value;
  const specialConditions = String(formData.get("special_conditions") ?? "").trim() || null;
  const internalNotes = String(formData.get("internal_notes") ?? "").trim() || null;
  const textChecks = [
    checkTextMax(adjustmentPolicy, MAX_ADJUSTMENT_POLICY, "La política de ajuste"),
    checkTextMax(specialConditions, MAX_APPLICATION_TEXT, "Las condiciones especiales"),
    checkTextMax(internalNotes, MAX_APPLICATION_TEXT, "Las notas internas"),
  ];
  const tooLong = textChecks.find((c) => !c.ok);
  if (tooLong && !tooLong.ok) return { status: "error", message: tooLong.error };

  // Docs/07 §15.4: al menos un campo debe diferir de las condiciones originales.
  const hasAnyChange =
    monthlyPriceUsd !== null ||
    enrollmentFeeUsd !== null ||
    depositUsd !== null ||
    startDate !== null ||
    durationMonths !== null ||
    (adjustmentPolicy !== null && adjustmentPolicy !== "") ||
    reservationAmountUsd !== null ||
    (specialConditions !== null && specialConditions.length > 0);
  if (!hasAnyChange) {
    return { status: "error", message: "Modificá al menos una condición o agregá condiciones especiales." };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { data: insertedProposal, error: proposalError } = await admin.from("application_negotiation_proposals").insert({
    application_request_id: applicationId,
    sent_by_user_id: sessionUser.id,
    residence_id: application.residence_id,
    proposed_monthly_price_usd: monthlyPriceUsd,
    proposed_monthly_price_ars: monthlyPriceUsd !== null ? usdToArs(monthlyPriceUsd, arsPerUsd) : null,
    proposed_enrollment_fee_usd: enrollmentFeeUsd,
    proposed_enrollment_fee_ars: enrollmentFeeUsd !== null ? usdToArs(enrollmentFeeUsd, arsPerUsd) : null,
    proposed_deposit_usd: depositUsd,
    proposed_deposit_ars: depositUsd !== null ? usdToArs(depositUsd, arsPerUsd) : null,
    proposed_start_date: startDate,
    proposed_duration_months: durationMonths,
    proposed_adjustment_policy: adjustmentPolicy,
    proposed_reservation_payment_amount_usd: reservationAmountUsd,
    special_conditions: specialConditions,
    internal_notes: internalNotes,
    warning_shown_at: now.toISOString(),
    warning_accepted_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  }).select("id").single();
  if (proposalError || !insertedProposal) {
    console.error("[negotiation] insert failed:", proposalError);
    return { status: "error", message: "No pudimos enviar la propuesta. Intentá de nuevo." };
  }

  // Primero la propuesta, después el cambio de estado condicionado a `contact_established`: si el
  // proceso se corta entre ambos pasos queda una propuesta suelta (inofensiva), nunca una solicitud
  // en `offer_pending_student_acceptance` sin propuesta. Si otro actor (job de vencimiento, otra
  // pestaña, `enableResidencePayment`) movió la solicitud, se borra la propuesta recién insertada.
  const { data: claimed, error: claimError } = await admin
    .from("application_requests")
    .update({
      status: "offer_pending_student_acceptance",
      proposal_count: 1,
      payment_deadline_at: expiresAt.toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "contact_established")
    .select("id")
    .maybeSingle();
  if (claimError || !claimed) {
    if (claimError) console.error("[negotiation] status update failed:", claimError);
    const { error: cleanupError } = await admin
      .from("application_negotiation_proposals")
      .delete()
      .eq("id", insertedProposal.id);
    if (cleanupError) console.error("[negotiation] no se pudo borrar la propuesta huérfana:", cleanupError);
    return {
      status: "error",
      message: claimError
        ? "No pudimos enviar la propuesta. Intentá de nuevo."
        : "La solicitud ya cambió de estado, actualizá la página.",
    };
  }

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: "contact_established",
    to_status: "offer_pending_student_acceptance",
    changed_by_user_id: sessionUser.id,
    changed_by_role: access.actorRole,
  });

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: access.actorRole,
    action: "negotiation_proposal_sent",
    entityType: "application_requests",
    entityId: applicationId,
  });

  revalidatePath(`/residence/${application.residence_id}/applications`);
  redirect(`/residence/${application.residence_id}/applications?app=${applicationId}`);
}

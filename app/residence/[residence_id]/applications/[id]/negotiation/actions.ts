"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidenceAccess } from "@/lib/residences/access";
import { createAuditLog } from "@/lib/audit";
import { usdToArs } from "@/lib/mock/exchange";

export type SendProposalState = { status: "idle" | "error"; message?: string };

function numOrNull(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? Number(raw) : null;
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

  // Docs/06 §11.2: la ARS de la propuesta usa la cotización de la
  // solicitud original — nunca la del día en que se envía la propuesta.
  const { data: originalSnapshot } = await admin
    .from("application_snapshots")
    .select("exchange_rate_ars_per_usd")
    .eq("id", application.snapshot_original_id)
    .single();
  if (!originalSnapshot) return { status: "error", message: "No encontramos el snapshot original." };
  const arsPerUsd = Number(originalSnapshot.exchange_rate_ars_per_usd);

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, application.residence_id);
  if (!hasAccess) return { status: "error", message: "No tenés acceso a esa residencia." };
  if (application.status !== "contact_established") {
    return { status: "error", message: "Solo podés proponer un ajuste después de establecer contacto." };
  }
  if (application.proposal_count > 0) {
    return { status: "error", message: "Ya enviaste tu única propuesta de ajuste para esta solicitud." };
  }
  if (formData.get("warning_acknowledged") !== "on") {
    return { status: "error", message: "Tenés que confirmar que leíste la advertencia." };
  }

  const monthlyPriceUsd = numOrNull(formData, "proposed_monthly_price_usd");
  const enrollmentFeeUsd = numOrNull(formData, "proposed_enrollment_fee_usd");
  const depositUsd = numOrNull(formData, "proposed_deposit_usd");
  const startDate = String(formData.get("proposed_start_date") ?? "").trim() || null;
  const durationMonths = numOrNull(formData, "proposed_duration_months");
  const adjustmentPolicy = String(formData.get("proposed_adjustment_policy") ?? "").trim() || null;
  const reservationAmountUsd = numOrNull(formData, "proposed_reservation_payment_amount_usd");
  const specialConditions = String(formData.get("special_conditions") ?? "").trim() || null;
  const internalNotes = String(formData.get("internal_notes") ?? "").trim() || null;

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

  const { error: proposalError } = await admin.from("application_negotiation_proposals").insert({
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
  });
  if (proposalError) {
    console.error("[negotiation] insert failed:", proposalError);
    return { status: "error", message: "No pudimos enviar la propuesta. Intentá de nuevo." };
  }

  await admin
    .from("application_requests")
    .update({
      status: "offer_pending_student_acceptance",
      proposal_count: 1,
      payment_deadline_at: expiresAt.toISOString(),
    })
    .eq("id", applicationId);

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: "contact_established",
    to_status: "offer_pending_student_acceptance",
    changed_by_user_id: sessionUser.id,
    changed_by_role: "residence_owner",
  });

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "residence_owner",
    action: "negotiation_proposal_sent",
    entityType: "application_requests",
    entityId: applicationId,
  });

  revalidatePath(`/residence/${application.residence_id}/applications/${applicationId}`);
  redirect(`/residence/${application.residence_id}/applications/${applicationId}`);
}

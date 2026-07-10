import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import { createPendingResidencePayment } from "@/lib/applications/residencePayment";

export type RecordNegotiationResponseResult = { ok: true } | { ok: false; error: string };

/**
 * Responder a la propuesta de ajuste (docs/07 §15.5, docs/03 §10ter.7-9).
 *
 * `accepted`: crea snapshot_final combinando lo propuesto (donde no sea
 * null) con lo original (donde la residencia no tocó el campo), y
 * recalcula el fee sobre esos valores finales. `rejected_chose_original`
 * / `rejected_closed`: docs/03 §10ter.8. Encadena `conditions_accepted`
 * → `residence_payment_pending` en la misma operación (docs/04 §5.4:
 * es un estado de tránsito automático, no debe quedar la solicitud
 * parada ahí — ver nota histórica en el server action original).
 *
 * Extraído del server action (Ciclo 21, GAPS.md — mismo patrón aplicado
 * a `markResidencePaymentReceived`/`markFeePaidManually` en el Ciclo 20)
 * para que la lógica de negocio sea testeable sin `next/headers`. El
 * server action mantiene `redirect()` — no puede vivir acá, solo
 * funciona invocado dentro del ciclo de vida real de un Server Action.
 */
export async function recordNegotiationResponse(
  admin: SupabaseClient,
  params: {
    applicationId: string;
    response: "accepted" | "rejected_chose_original" | "rejected_closed";
    actorUserId: string;
  },
): Promise<RecordNegotiationResponseResult> {
  const { data: application } = await admin
    .from("application_requests")
    .select("id, status, student_profile_id, snapshot_original_id, residence_id, room_type_id")
    .eq("id", params.applicationId)
    .maybeSingle();
  if (!application) return { ok: false, error: "No encontramos esa solicitud." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile || studentProfile.id !== application.student_profile_id) {
    return { ok: false, error: "Esta solicitud no te pertenece." };
  }
  if (application.status !== "offer_pending_student_acceptance") {
    return { ok: false, error: "Esta solicitud no tiene una propuesta pendiente." };
  }

  const { data: proposal } = await admin
    .from("application_negotiation_proposals")
    .select("*")
    .eq("application_request_id", params.applicationId)
    .maybeSingle();
  if (!proposal) return { ok: false, error: "No encontramos la propuesta." };
  if (new Date(proposal.expires_at) < new Date()) {
    return { ok: false, error: "Esta propuesta ya venció." };
  }

  const { response, applicationId, actorUserId } = params;
  let newStatus: string;
  let snapshotFinalId: string;
  const now = new Date();

  if (response === "accepted") {
    const { data: original } = await admin
      .from("application_snapshots")
      .select("*")
      .eq("id", application.snapshot_original_id)
      .single();

    const monthlyPriceUsd = proposal.proposed_monthly_price_usd ?? original.monthly_price_usd;
    const durationMonths = proposal.proposed_duration_months ?? original.initial_duration_months;
    const enrollmentFeeUsd = proposal.proposed_enrollment_fee_usd ?? original.enrollment_fee_usd;
    const fee = calculateFeeEstimate({
      monthlyPriceUsd: Number(monthlyPriceUsd),
      durationMonths: Number(durationMonths),
      enrollmentFeeUsd: enrollmentFeeUsd ? Number(enrollmentFeeUsd) : null,
      arsPerUsd: Number(original.exchange_rate_ars_per_usd),
    });

    const { data: finalSnapshot, error: snapshotError } = await admin
      .from("application_snapshots")
      .insert({
        application_request_id: applicationId,
        snapshot_type: "final",
        residence_id: application.residence_id,
        room_type_id: proposal.proposed_room_type_id ?? application.room_type_id,
        place_id: proposal.proposed_place_id ?? original.place_id,
        monthly_price_usd: monthlyPriceUsd,
        monthly_price_ars: proposal.proposed_monthly_price_ars ?? original.monthly_price_ars,
        // Docs/06 §11.2: el snapshot_final hereda el tipo de cambio del
        // original — la negociación nunca actualiza la cotización.
        exchange_rate_ars_per_usd: original.exchange_rate_ars_per_usd,
        exchange_rate_source: original.exchange_rate_source,
        exchange_rate_date: original.exchange_rate_date,
        initial_duration_months: durationMonths,
        enrollment_fee_usd: enrollmentFeeUsd,
        enrollment_fee_ars: proposal.proposed_enrollment_fee_ars ?? original.enrollment_fee_ars,
        deposit_usd: proposal.proposed_deposit_usd ?? original.deposit_usd,
        deposit_ars: proposal.proposed_deposit_ars ?? original.deposit_ars,
        deposit_excluded_from_fee: true,
        reservation_payment_amount_usd:
          proposal.proposed_reservation_payment_amount_usd ?? original.reservation_payment_amount_usd,
        reservation_payment_amount_ars: original.reservation_payment_amount_ars,
        adjustment_policy: proposal.proposed_adjustment_policy ?? original.adjustment_policy,
        fee_base_usd: fee.feeBaseUsd,
        fee_base_ars: fee.feeBaseArs,
        estimated_estured_fee_ars: fee.estimatedFeeArs,
        raw_snapshot: { special_conditions: proposal.special_conditions },
      })
      .select("id")
      .single();
    if (snapshotError || !finalSnapshot) {
      console.error("[negotiation] snapshot_final failed:", snapshotError);
      return { ok: false, error: "No pudimos procesar tu respuesta. Intentá de nuevo." };
    }
    snapshotFinalId = finalSnapshot.id;
    newStatus = "residence_payment_pending";

    await admin
      .from("application_requests")
      .update({
        snapshot_final_id: snapshotFinalId,
        status: newStatus,
        payment_deadline_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        desired_start_date: proposal.proposed_start_date ?? undefined,
        initial_duration_months: durationMonths,
      })
      .eq("id", applicationId);
  } else if (response === "rejected_chose_original") {
    newStatus = "residence_payment_pending";
    await admin
      .from("application_requests")
      .update({
        snapshot_final_id: application.snapshot_original_id,
        status: newStatus,
        payment_deadline_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", applicationId);
  } else {
    newStatus = "cancelled_by_student";
    await admin.from("application_requests").update({ status: newStatus }).eq("id", applicationId);
  }

  await admin
    .from("application_negotiation_proposals")
    .update({
      student_response: response,
      student_response_at: now.toISOString(),
      student_response_by_user_id: actorUserId,
    })
    .eq("id", proposal.id);

  if (newStatus === "residence_payment_pending") {
    await admin.from("application_status_events").insert({
      application_request_id: applicationId,
      from_status: "offer_pending_student_acceptance",
      to_status: "conditions_accepted",
      changed_by_user_id: actorUserId,
      changed_by_role: "student",
      reason_code: response,
    });
    await admin.from("application_status_events").insert({
      application_request_id: applicationId,
      from_status: "conditions_accepted",
      to_status: "residence_payment_pending",
      changed_by_role: "system",
      reason_text: "Condiciones aceptadas — pago a residencia habilitado automáticamente.",
    });
    await createPendingResidencePayment(admin, {
      applicationId,
      residenceId: application.residence_id,
      studentProfileId: application.student_profile_id,
    });
  } else {
    await admin.from("application_status_events").insert({
      application_request_id: applicationId,
      from_status: "offer_pending_student_acceptance",
      to_status: newStatus,
      changed_by_user_id: actorUserId,
      changed_by_role: "student",
      reason_code: response,
    });
  }

  await createAuditLog(admin, {
    actorUserId,
    actorRole: "student",
    action: `negotiation_${response}`,
    entityType: "application_requests",
    entityId: applicationId,
  });

  return { ok: true };
}

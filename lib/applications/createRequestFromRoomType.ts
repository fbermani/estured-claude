import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { usdToArs } from "@/lib/mock/exchange";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { calculateFeeEstimate } from "@/lib/applications/fee";

/**
 * Crea el snapshot original + la solicitud (docs/06 §11.1-11.2), sea
 * que la inicie el estudiante directo (`createApplicationRequest`) o
 * el familiar vía propuesta aprobada (`respondFamilyProposal`). Extraído
 * en el Ciclo 12 para no duplicar esta lógica entre ambos caminos.
 */
export async function createApplicationFromRoomType(
  admin: SupabaseClient,
  params: {
    studentProfileId: string;
    residenceId: string;
    roomTypeId: string;
    roomType: {
      monthly_price_usd: number;
      enrollment_fee_usd: number | null;
      deposit_usd: number | null;
      adjustment_policy: string;
    };
    desiredStartDate: string;
    durationMonths: number;
    academicObjective: string;
    initiatedBy: "student" | "family_member";
    contactTarget: "student" | "family_member";
    familyLinkId: string | null;
    familyProposalId: string | null;
    createdByUserId: string;
    actorRole: "student" | "family_member";
  },
): Promise<{ id: string } | { error: string }> {
  const rate = await getCurrentExchangeRate();
  const monthlyPriceUsd = Number(params.roomType.monthly_price_usd);
  const enrollmentFeeUsd = params.roomType.enrollment_fee_usd ? Number(params.roomType.enrollment_fee_usd) : null;
  const depositUsd = params.roomType.deposit_usd ? Number(params.roomType.deposit_usd) : null;
  const fee = calculateFeeEstimate({
    monthlyPriceUsd,
    durationMonths: params.durationMonths,
    enrollmentFeeUsd,
    arsPerUsd: rate.arsPerUsd,
  });

  try {
    const { data: snapshot, error: snapshotError } = await admin
      .from("application_snapshots")
      .insert({
        snapshot_type: "original",
        residence_id: params.residenceId,
        room_type_id: params.roomTypeId,
        monthly_price_usd: monthlyPriceUsd,
        monthly_price_ars: usdToArs(monthlyPriceUsd, rate.arsPerUsd),
        exchange_rate_ars_per_usd: rate.arsPerUsd,
        exchange_rate_source: rate.source,
        exchange_rate_date: rate.rateDate,
        initial_duration_months: params.durationMonths,
        enrollment_fee_usd: enrollmentFeeUsd,
        enrollment_fee_ars: enrollmentFeeUsd ? usdToArs(enrollmentFeeUsd, rate.arsPerUsd) : null,
        deposit_usd: depositUsd,
        deposit_ars: depositUsd ? usdToArs(depositUsd, rate.arsPerUsd) : null,
        deposit_excluded_from_fee: true,
        reservation_payment_amount_usd: enrollmentFeeUsd ?? monthlyPriceUsd,
        reservation_payment_amount_ars: usdToArs(enrollmentFeeUsd ?? monthlyPriceUsd, rate.arsPerUsd),
        adjustment_policy: params.roomType.adjustment_policy,
        fee_base_usd: fee.feeBaseUsd,
        fee_base_ars: fee.feeBaseArs,
        estimated_estured_fee_ars: fee.estimatedFeeArs,
      })
      .select("id")
      .single();
    if (snapshotError || !snapshot) throw snapshotError;

    const { data: request, error: requestError } = await admin
      .from("application_requests")
      .insert({
        student_profile_id: params.studentProfileId,
        family_link_id: params.familyLinkId,
        family_proposal_id: params.familyProposalId,
        initiated_by: params.initiatedBy,
        contact_target: params.contactTarget,
        residence_id: params.residenceId,
        room_type_id: params.roomTypeId,
        desired_start_date: params.desiredStartDate,
        initial_duration_months: params.durationMonths,
        academic_objective: params.academicObjective,
        snapshot_original_id: snapshot.id,
        created_by_user_id: params.createdByUserId,
      })
      .select("id")
      .single();
    if (requestError || !request) throw requestError;

    await admin.from("application_snapshots").update({ application_request_id: request.id }).eq("id", snapshot.id);

    await admin.from("application_status_events").insert({
      application_request_id: request.id,
      from_status: null,
      to_status: "submitted",
      changed_by_user_id: params.createdByUserId,
      changed_by_role: params.actorRole,
    });

    await createAuditLog(admin, {
      actorUserId: params.createdByUserId,
      actorRole: params.actorRole,
      action: "application_request_submitted",
      entityType: "application_requests",
      entityId: request.id,
      newValue: { residence_id: params.residenceId, room_type_id: params.roomTypeId, contact_target: params.contactTarget },
    });

    return { id: request.id };
  } catch (error) {
    console.error("[application] create-from-room-type failed:", error);
    return { error: "No pudimos crear la solicitud. Intentá de nuevo en unos minutos." };
  }
}

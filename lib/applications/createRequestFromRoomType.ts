import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { usdToArs } from "@/lib/mock/exchange";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import { resolveReservationMoney, todayIso } from "@/lib/applications/reservationMoney";
import { getResidenceConditions } from "@/lib/residences/conditions";
import { getActivePromotionForType } from "@/lib/residences/promotions";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import { determineInitialApplicationStatus } from "@/lib/applications/roomTypeQueue";

/**
 * Crea el snapshot original + la solicitud (docs/06 §11.1-11.2), sea
 * que la inicie el estudiante directo (`createApplicationRequest`) o
 * el familiar vía propuesta aprobada (`respondFamilyProposal`). Extraído
 * en el Ciclo 12 para no duplicar esta lógica entre ambos caminos.
 * Desde la migración 0025, matrícula/depósito/ajuste/mes vacío salen de
 * las condiciones de la RESIDENCIA (no del tipo) y quedan congeladas en
 * el snapshot como siempre. El pago inicial a la residencia
 * (`reservation_payment_amount_*`) sale de `lib/reservations/initialPayment.ts`.
 */
export async function createApplicationFromRoomType(
  admin: SupabaseClient,
  params: {
    studentProfileId: string;
    residenceId: string;
    roomTypeId: string;
    roomType: {
      monthly_price_usd: number;
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
    /** Aviso "Quiero cambiar" bajo cuya excepción (DR3) se crea la solicitud, si aplica (`checkReservationWindowOverlap`). */
    stayChangeIntentId?: string | null;
    /** Nota voluntaria del estudiante a esta residencia ("desde dónde te mudás y por qué"); solo se guarda con `stayChangeIntentId`. */
    movingContextNote?: string | null;
    /** DR14: la solicitud nace SIN aceptación del reglamento (propuesta del familiar, lista de espera, menor, o ficha con aceptación a registrar): la residencia no puede avanzarla hasta que exista la fila de aceptación. Solo con la migración 0053 aplicada. */
    regulationPending?: boolean;
  },
): Promise<{ id: string } | { error: string }> {
  const initialStatus = await determineInitialApplicationStatus(admin, params.roomTypeId);
  if ("error" in initialStatus) return { error: initialStatus.error };

  const conditions = await getResidenceConditions(admin, params.residenceId);
  if (!conditions) return { error: "No pudimos leer las condiciones de la residencia." };
  if (conditions.minimumStayMonths != null && params.durationMonths < conditions.minimumStayMonths) {
    return {
      error: `Esta residencia pide una estadía mínima de ${conditions.minimumStayMonths} meses.`,
    };
  }

  const rate = await getCurrentExchangeRate();
  const listMonthlyUsd = Number(params.roomType.monthly_price_usd);
  // DR18 t3: promoción vigente (la de mayor %), descuento de matrícula, depósito en meses y pago inicial «solo matrícula».
  // Todo se resuelve en `resolveReservationMoney` (la misma función que usa la previa del cliente) y queda congelado en el snapshot.
  const promotionResult = await getActivePromotionForType(admin, params.residenceId, params.roomTypeId);
  if ("error" in promotionResult) return { error: promotionResult.error };
  const promotion = promotionResult.promotion;
  const money = resolveReservationMoney({
    listMonthlyUsd,
    promotionPercent: promotion?.discountPercent ?? null,
    conditions,
    arsPerUsd: rate.arsPerUsd,
    today: todayIso(),
  });
  const monthlyPriceUsd = money.monthlyUsd;
  const enrollmentFeeUsd = money.enrollment.listUsd > 0 ? money.enrollment.netUsd : null;
  const depositUsd = money.depositUsd;
  const initialPayment = money.initialPayment;
  // El mes vacío es contingente (solo se cobra si la plaza queda realmente vacía, docs/00 DR18 t3): NO entra a la base del fee.
  // El fee se calcula sobre lo que paga el estudiante: renta con promoción + matrícula ya descontada.
  const fee = calculateFeeEstimate({
    monthlyPriceUsd,
    durationMonths: params.durationMonths,
    enrollmentFeeUsd,
    arsPerUsd: rate.arsPerUsd,
  });
  // Columnas de «antes/ahora» (migración 0060): solo si hay promoción o descuento, para no tocar el insert de siempre.
  const beforeAfterColumns =
    promotion || money.enrollment.discountPercent > 0
      ? {
          ...(promotion
            ? { list_monthly_price_usd: listMonthlyUsd, promotion_percent: promotion.discountPercent, promotion_id: promotion.id }
            : {}),
          ...(money.enrollment.discountPercent > 0
            ? {
                enrollment_fee_list_usd: money.enrollment.listUsd,
                enrollment_fee_discount_percent: money.enrollment.discountPercent,
              }
            : {}),
        }
      : {};

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
        reservation_payment_amount_usd: initialPayment.usd,
        reservation_payment_amount_ars: initialPayment.arsSnapshot,
        adjustment_policy: conditions.adjustmentPolicy,
        fee_base_usd: fee.feeBaseUsd,
        fee_base_ars: fee.feeBaseArs,
        estimated_estured_fee_ars: fee.estimatedFeeArs,
        ...beforeAfterColumns,
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
        status: initialStatus.status,
        desired_start_date: params.desiredStartDate,
        initial_duration_months: params.durationMonths,
        academic_objective: params.academicObjective,
        snapshot_original_id: snapshot.id,
        created_by_user_id: params.createdByUserId,
        // Solo con el aviso "Quiero cambiar" (DR3): sin él no se tocan estas columnas (migración 0044).
        ...(params.stayChangeIntentId
          ? { stay_change_intent_id: params.stayChangeIntentId, move_context_note: params.movingContextNote ?? null }
          : {}),
        ...(params.regulationPending ? { regulation_acceptance_pending: true } : {}),
      })
      .select("id")
      .single();
    if (requestError || !request) throw requestError;

    await admin.from("application_snapshots").update({ application_request_id: request.id }).eq("id", snapshot.id);

    await admin.from("application_status_events").insert({
      application_request_id: request.id,
      from_status: null,
      to_status: initialStatus.status,
      changed_by_user_id: params.createdByUserId,
      changed_by_role: params.actorRole,
    });

    await createAuditLog(admin, {
      actorUserId: params.createdByUserId,
      actorRole: params.actorRole,
      action: initialStatus.status === "queued_for_place" ? "application_request_queued" : "application_request_submitted",
      entityType: "application_requests",
      entityId: request.id,
      newValue: { residence_id: params.residenceId, room_type_id: params.roomTypeId, contact_target: params.contactTarget },
    });

    // Aviso al equipo de la residencia (best-effort). Las solicitudes en cola aún no son visibles: no avisan.
    if (initialStatus.status === "submitted") {
      await notifyResidenceTeam(admin, { residenceId: params.residenceId, event: "new_application", entityId: request.id });
    }

    return { id: request.id };
  } catch (error) {
    console.error("[application] create-from-room-type failed:", error);
    return { error: "No pudimos crear la solicitud. Intentá de nuevo en unos minutos." };
  }
}

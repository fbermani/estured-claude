import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/applications/types";
import { createApplicationFromRoomType } from "@/lib/applications/createRequestFromRoomType";

export type RecordFamilyProposalResponseResult =
  | { ok: true; applicationId: string | null }
  | { ok: false; error: string };

/**
 * El estudiante aprueba o rechaza la propuesta del familiar (docs/07
 * §9.2-9.3, docs/03 §10bis.3). Al aprobar se pide el objetivo académico
 * acá, no en la propuesta del familiar — ver nota en la migración 0012.
 * `applicationId` viene `null` en el rechazo (no se crea nada).
 *
 * Extraída del server action (Ciclo 21, GAPS.md — mismo patrón aplicado
 * a `markResidencePaymentReceived`/`markFeePaidManually` en el Ciclo 20
 * y `respondNegotiationProposal` en este mismo ciclo) para que la
 * lógica de negocio sea testeable sin `next/headers`.
 */
export async function recordFamilyProposalResponse(
  admin: SupabaseClient,
  params: {
    proposalId: string;
    decision: "approve" | "reject";
    actorUserId: string;
    rejectionReason: string | null;
    academicObjective: string | null;
  },
): Promise<RecordFamilyProposalResponseResult> {
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile) return { ok: false, error: "No encontramos tu perfil de estudiante." };

  const { data: proposal } = await admin
    .from("family_application_proposals")
    .select(
      "id, status, expires_at, student_profile_id, residence_id, room_type_id, family_link_id, desired_start_date, initial_duration_months",
    )
    .eq("id", params.proposalId)
    .maybeSingle();
  if (!proposal || proposal.student_profile_id !== studentProfile.id) {
    return { ok: false, error: "No encontramos esa propuesta." };
  }
  if (proposal.status !== "pending_student_approval") {
    return { ok: false, error: "Esa propuesta ya fue resuelta." };
  }
  if (new Date(proposal.expires_at) < new Date()) {
    return { ok: false, error: "Esta propuesta ya venció." };
  }

  if (params.decision === "reject") {
    await admin
      .from("family_application_proposals")
      .update({
        status: "rejected_by_student",
        student_response_at: new Date().toISOString(),
        student_response_by_user_id: params.actorUserId,
        rejection_reason: params.rejectionReason,
      })
      .eq("id", params.proposalId);

    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: "student",
      action: "family_proposal_rejected",
      entityType: "family_application_proposals",
      entityId: params.proposalId,
      reasonText: params.rejectionReason ?? undefined,
    });

    return { ok: true, applicationId: null };
  }

  // Aprobar.
  const academicObjective = (params.academicObjective ?? "").trim();
  if (academicObjective.length < 10) {
    return { ok: false, error: "Contanos brevemente tu objetivo académico (obligatorio para el comprobante)." };
  }

  const { data: link } = await admin
    .from("family_links")
    .select("id, status, family_members(phone)")
    .eq("id", proposal.family_link_id)
    .maybeSingle();
  const familyMember = link?.family_members as unknown as { phone: string | null } | null;
  if (!link || link.status !== "active") {
    return { ok: false, error: "El vínculo con tu familiar ya no está activo." };
  }
  if (!familyMember?.phone) {
    return { ok: false, error: "Tu familiar necesita tener un teléfono cargado para poder solicitar." };
  }

  const { count: activeCount } = await admin
    .from("application_requests")
    .select("*", { count: "exact", head: true })
    .eq("student_profile_id", studentProfile.id)
    .in("status", ACTIVE_APPLICATION_STATUSES);
  if ((activeCount ?? 0) >= 2) {
    return {
      ok: false,
      error: "Ya tenés 2 solicitudes activas — es el máximo permitido. Cerrá una antes de aprobar esta propuesta.",
    };
  }

  const { data: roomType } = await admin
    .from("room_types")
    .select("id, monthly_price_usd, enrollment_fee_usd, deposit_usd, adjustment_policy, is_active, profile_availability(status)")
    .eq("id", proposal.room_type_id)
    .eq("residence_id", proposal.residence_id)
    .maybeSingle();
  const availability = roomType?.profile_availability as unknown as { status: string }[] | undefined;
  if (!roomType || !roomType.is_active) {
    return { ok: false, error: "Ese tipo de habitación ya no está disponible." };
  }
  if (availability?.[0]?.status === "full") {
    return { ok: false, error: "Esa habitación ya no tiene lugar." };
  }

  const result = await createApplicationFromRoomType(admin, {
    studentProfileId: studentProfile.id,
    residenceId: proposal.residence_id,
    roomTypeId: proposal.room_type_id,
    roomType: {
      monthly_price_usd: Number(roomType.monthly_price_usd),
      enrollment_fee_usd: roomType.enrollment_fee_usd ? Number(roomType.enrollment_fee_usd) : null,
      deposit_usd: roomType.deposit_usd ? Number(roomType.deposit_usd) : null,
      adjustment_policy: roomType.adjustment_policy,
    },
    desiredStartDate: proposal.desired_start_date,
    durationMonths: proposal.initial_duration_months,
    academicObjective,
    initiatedBy: "family_member",
    contactTarget: "family_member",
    familyLinkId: proposal.family_link_id,
    familyProposalId: proposal.id,
    createdByUserId: params.actorUserId,
    actorRole: "student",
  });
  if ("error" in result) return { ok: false, error: result.error };

  await admin
    .from("family_application_proposals")
    .update({
      status: "approved_by_student",
      student_response_at: new Date().toISOString(),
      student_response_by_user_id: params.actorUserId,
      converted_to_application_id: result.id,
    })
    .eq("id", params.proposalId);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "family_proposal_approved",
    entityType: "family_application_proposals",
    entityId: params.proposalId,
    newValue: { converted_to_application_id: result.id },
  });

  return { ok: true, applicationId: result.id };
}

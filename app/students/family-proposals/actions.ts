"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/applications/types";
import { createApplicationFromRoomType } from "@/lib/applications/createRequestFromRoomType";

export type CreateFamilyProposalState = { status: "idle" | "error"; message?: string };
export type RespondFamilyProposalState = { status: "idle" | "error"; message?: string };

/**
 * Crear propuesta de solicitud del familiar (docs/07 §9.1, docs/03
 * §10bis). No es una solicitud activa, no la ve la residencia hasta
 * que el estudiante la aprueba (`respondFamilyProposal`).
 */
export async function createFamilyProposal(
  residenceId: string,
  _prev: CreateFamilyProposalState,
  formData: FormData,
): Promise<CreateFamilyProposalState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !sessionUser.roles.includes("family_member")) {
    return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const studentProfileId = String(formData.get("student_profile_id") ?? "");
  const roomTypeId = String(formData.get("room_type_id") ?? "");
  const desiredStartDate = String(formData.get("desired_start_date") ?? "");
  const durationMonths = Number(formData.get("initial_duration_months") ?? 0);
  const messageToStudent = String(formData.get("message_to_student") ?? "").trim() || null;

  if (!studentProfileId) return { status: "error", message: "Elegí a qué estudiante le proponés esto." };
  if (!roomTypeId) return { status: "error", message: "Elegí un tipo de habitación." };
  if (!desiredStartDate) return { status: "error", message: "Elegí una fecha de ingreso estimada." };
  if (durationMonths < 1 || durationMonths > 24)
    return { status: "error", message: "La duración debe ser entre 1 y 24 meses." };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const { data: familyMember } = await admin
    .from("family_members")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!familyMember) return { status: "error", message: "No encontramos tu perfil de familiar." };

  const { data: link } = await admin
    .from("family_links")
    .select("id, permissions")
    .eq("family_member_id", familyMember.id)
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active")
    .maybeSingle();
  if (!link) return { status: "error", message: "No tenés un vínculo activo con ese estudiante." };
  const permissions = link.permissions as { can_create_proposals?: boolean } | null;
  if (permissions?.can_create_proposals === false) {
    return { status: "error", message: "No tenés permiso para crear propuestas para este estudiante." };
  }

  const { data: residence } = await admin
    .from("residences")
    .select("id, status")
    .eq("id", residenceId)
    .maybeSingle();
  if (!residence || residence.status !== "verified_active") {
    return { status: "error", message: "Esta residencia ya no está disponible para proponer." };
  }

  const { data: roomType } = await admin
    .from("room_types")
    .select("id, is_active, profile_availability(status)")
    .eq("id", roomTypeId)
    .eq("residence_id", residenceId)
    .maybeSingle();
  const availability = roomType?.profile_availability as unknown as { status: string }[] | undefined;
  if (!roomType || !roomType.is_active) {
    return { status: "error", message: "Ese tipo de habitación ya no está disponible." };
  }
  if (availability?.[0]?.status === "full") {
    return { status: "error", message: "Esa habitación ya no tiene lugar. Probá otro tipo." };
  }

  const { data: proposal, error } = await admin
    .from("family_application_proposals")
    .insert({
      family_link_id: link.id,
      family_member_id: familyMember.id,
      student_profile_id: studentProfileId,
      residence_id: residenceId,
      room_type_id: roomTypeId,
      desired_start_date: desiredStartDate,
      initial_duration_months: durationMonths,
      message_to_student: messageToStudent,
    })
    .select("id")
    .single();
  if (error || !proposal) {
    console.error("[family-proposal] create failed:", error);
    return { status: "error", message: "No pudimos enviar la propuesta. Intentá de nuevo en unos minutos." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "family_member",
    action: "family_proposal_created",
    entityType: "family_application_proposals",
    entityId: proposal.id,
    newValue: { residence_id: residenceId, room_type_id: roomTypeId, student_profile_id: studentProfileId },
  });

  redirect("/students/dashboard");
}

/**
 * El estudiante aprueba o rechaza la propuesta (docs/07 §9.2-9.3,
 * docs/03 §10bis.3). Al aprobar se pide el objetivo académico acá, no
 * en la propuesta del familiar — ver nota en la migración 0012.
 */
export async function respondFamilyProposal(
  proposalId: string,
  decision: "approve" | "reject",
  _prev: RespondFamilyProposalState,
  formData: FormData,
): Promise<RespondFamilyProposalState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!studentProfile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const { data: proposal } = await admin
    .from("family_application_proposals")
    .select("id, status, expires_at, student_profile_id, residence_id, room_type_id, family_link_id, desired_start_date, initial_duration_months")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal || proposal.student_profile_id !== studentProfile.id) {
    return { status: "error", message: "No encontramos esa propuesta." };
  }
  if (proposal.status !== "pending_student_approval") {
    return { status: "error", message: "Esa propuesta ya fue resuelta." };
  }
  if (new Date(proposal.expires_at) < new Date()) {
    return { status: "error", message: "Esta propuesta ya venció." };
  }

  if (decision === "reject") {
    const reason = String(formData.get("reason") ?? "").trim() || null;
    await admin
      .from("family_application_proposals")
      .update({
        status: "rejected_by_student",
        student_response_at: new Date().toISOString(),
        student_response_by_user_id: sessionUser.id,
        rejection_reason: reason,
      })
      .eq("id", proposalId);

    await createAuditLog(admin, {
      actorUserId: sessionUser.id,
      actorRole: "student",
      action: "family_proposal_rejected",
      entityType: "family_application_proposals",
      entityId: proposalId,
      reasonText: reason ?? undefined,
    });

    revalidatePath("/students/family-proposals");
    revalidatePath("/students/dashboard");
    return { status: "idle" };
  }

  // Aprobar.
  const academicObjective = String(formData.get("academic_objective") ?? "").trim();
  if (academicObjective.length < 10) {
    return {
      status: "error",
      message: "Contanos brevemente tu objetivo académico (obligatorio para el comprobante).",
    };
  }

  const { data: link } = await admin
    .from("family_links")
    .select("id, status, family_members(phone)")
    .eq("id", proposal.family_link_id)
    .maybeSingle();
  const familyMember = link?.family_members as unknown as { phone: string | null } | null;
  if (!link || link.status !== "active") {
    return { status: "error", message: "El vínculo con tu familiar ya no está activo." };
  }
  if (!familyMember?.phone) {
    return { status: "error", message: "Tu familiar necesita tener un teléfono cargado para poder solicitar." };
  }

  const { count: activeCount } = await admin
    .from("application_requests")
    .select("*", { count: "exact", head: true })
    .eq("student_profile_id", studentProfile.id)
    .in("status", ACTIVE_APPLICATION_STATUSES);
  if ((activeCount ?? 0) >= 2) {
    return {
      status: "error",
      message: "Ya tenés 2 solicitudes activas — es el máximo permitido. Cerrá una antes de aprobar esta propuesta.",
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
    return { status: "error", message: "Ese tipo de habitación ya no está disponible." };
  }
  if (availability?.[0]?.status === "full") {
    return { status: "error", message: "Esa habitación ya no tiene lugar." };
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
    createdByUserId: sessionUser.id,
    actorRole: "student",
  });
  if ("error" in result) return { status: "error", message: result.error };

  await admin
    .from("family_application_proposals")
    .update({
      status: "approved_by_student",
      student_response_at: new Date().toISOString(),
      student_response_by_user_id: sessionUser.id,
      converted_to_application_id: result.id,
    })
    .eq("id", proposalId);

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "family_proposal_approved",
    entityType: "family_application_proposals",
    entityId: proposalId,
    newValue: { converted_to_application_id: result.id },
  });

  revalidatePath("/students/family-proposals");
  redirect(`/students/applications/${result.id}`);
}

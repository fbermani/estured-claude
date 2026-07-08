"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { usdToArs } from "@/lib/mock/exchange";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/applications/types";
import { calculateFeeEstimate } from "@/lib/applications/fee";

export type CreateApplicationState = { status: "idle" | "error"; message?: string };

/**
 * Crear solicitud de reserva (docs/07 §15.1, docs/00 §9-10).
 *
 * Fase 1: solo el estudiante inicia (initiated_by siempre 'student' —
 * que el familiar inicie requiere family_application_proposals, fase
 * posterior). El fee ya se estima (docs/00 §12) para mostrarlo en la
 * comparación de negociación, pero el cobro real es fase posterior.
 */
export async function createApplicationRequest(
  residenceId: string,
  _prev: CreateApplicationState,
  formData: FormData,
): Promise<CreateApplicationState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };

  const roomTypeId = String(formData.get("room_type_id") ?? "");
  if (!roomTypeId) return { status: "error", message: "Elegí un tipo de habitación." };
  const desiredStartDate = String(formData.get("desired_start_date") ?? "");
  const durationMonths = Number(formData.get("initial_duration_months") ?? 0);
  const academicObjective = String(formData.get("academic_objective") ?? "").trim();

  if (!desiredStartDate) return { status: "error", message: "Elegí una fecha de ingreso estimada." };
  if (durationMonths < 1 || durationMonths > 24)
    return { status: "error", message: "La duración debe ser entre 1 y 24 meses." };
  if (academicObjective.length < 10)
    return {
      status: "error",
      message: "Contanos brevemente tu objetivo académico (obligatorio para el comprobante).",
    };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id, is_minor, academic_objective")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!studentProfile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  // Docs/06 §5.1: teléfono del destinatario del contacto es obligatorio.
  // Docs/00 §17.3: si es menor, el contacto va siempre al familiar.
  let contactTarget: "student" | "family_member" = "student";
  let familyLinkId: string | null = null;

  if (studentProfile.is_minor) {
    const { data: link } = await admin
      .from("family_links")
      .select("id, family_members(phone)")
      .eq("student_profile_id", studentProfile.id)
      .eq("status", "active")
      .maybeSingle();
    const familyMember = link?.family_members as unknown as { phone: string | null } | null;
    if (!link || !familyMember?.phone) {
      return {
        status: "error",
        message:
          "Sos menor de edad: necesitás un familiar vinculado con teléfono cargado para poder solicitar.",
      };
    }
    contactTarget = "family_member";
    familyLinkId = link.id;
  } else {
    const { data: appUser } = await admin.from("users").select("phone").eq("id", sessionUser.id).single();
    if (!appUser?.phone) {
      return { status: "error", message: "Necesitás tener un teléfono cargado para poder solicitar." };
    }
  }

  // Máximo 2 solicitudes activas (docs/00 §9).
  const { count: activeCount } = await admin
    .from("application_requests")
    .select("*", { count: "exact", head: true })
    .eq("student_profile_id", studentProfile.id)
    .in("status", ACTIVE_APPLICATION_STATUSES);
  if ((activeCount ?? 0) >= 2) {
    return {
      status: "error",
      message: "Ya tenés 2 solicitudes activas — es el máximo permitido. Cerrá una para poder enviar otra.",
    };
  }

  const { data: residence } = await admin
    .from("residences")
    .select("id, status")
    .eq("id", residenceId)
    .maybeSingle();
  if (!residence || residence.status !== "verified_active") {
    return { status: "error", message: "Esta residencia ya no está disponible para solicitar." };
  }

  const { data: roomType } = await admin
    .from("room_types")
    .select(
      "id, monthly_price_usd, enrollment_fee_usd, deposit_usd, adjustment_policy, is_active, profile_availability(status)",
    )
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

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerStore.get("user-agent");
  const rate = await getCurrentExchangeRate();
  const monthlyPriceUsd = Number(roomType.monthly_price_usd);
  const enrollmentFeeUsd = roomType.enrollment_fee_usd ? Number(roomType.enrollment_fee_usd) : null;
  const depositUsd = roomType.deposit_usd ? Number(roomType.deposit_usd) : null;
  const fee = calculateFeeEstimate({ monthlyPriceUsd, durationMonths, enrollmentFeeUsd, arsPerUsd: rate.arsPerUsd });

  let newRequestId: string;
  try {
    const { data: snapshot, error: snapshotError } = await admin
      .from("application_snapshots")
      .insert({
        snapshot_type: "original",
        residence_id: residenceId,
        room_type_id: roomTypeId,
        monthly_price_usd: monthlyPriceUsd,
        monthly_price_ars: usdToArs(monthlyPriceUsd, rate.arsPerUsd),
        exchange_rate_ars_per_usd: rate.arsPerUsd,
        exchange_rate_source: rate.source,
        exchange_rate_date: rate.rateDate,
        initial_duration_months: durationMonths,
        enrollment_fee_usd: enrollmentFeeUsd,
        enrollment_fee_ars: enrollmentFeeUsd ? usdToArs(enrollmentFeeUsd, rate.arsPerUsd) : null,
        deposit_usd: depositUsd,
        deposit_ars: depositUsd ? usdToArs(depositUsd, rate.arsPerUsd) : null,
        deposit_excluded_from_fee: true,
        reservation_payment_amount_usd: enrollmentFeeUsd ?? monthlyPriceUsd,
        reservation_payment_amount_ars: usdToArs(enrollmentFeeUsd ?? monthlyPriceUsd, rate.arsPerUsd),
        adjustment_policy: roomType.adjustment_policy,
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
        student_profile_id: studentProfile.id,
        family_link_id: familyLinkId,
        initiated_by: "student",
        contact_target: contactTarget,
        residence_id: residenceId,
        room_type_id: roomTypeId,
        desired_start_date: desiredStartDate,
        initial_duration_months: durationMonths,
        academic_objective: academicObjective,
        snapshot_original_id: snapshot.id,
        created_by_user_id: sessionUser.id,
      })
      .select("id")
      .single();
    if (requestError || !request) throw requestError;
    newRequestId = request.id;

    await admin.from("application_snapshots").update({ application_request_id: request.id }).eq("id", snapshot.id);

    await admin.from("application_status_events").insert({
      application_request_id: request.id,
      from_status: null,
      to_status: "submitted",
      changed_by_user_id: sessionUser.id,
      changed_by_role: "student",
    });

    await createAuditLog(admin, {
      actorUserId: sessionUser.id,
      actorRole: "student",
      action: "application_request_submitted",
      entityType: "application_requests",
      entityId: request.id,
      newValue: { residence_id: residenceId, room_type_id: roomTypeId, contact_target: contactTarget },
      ipAddress: ip,
      userAgent,
    });
  } catch (error) {
    console.error("[application] create failed:", error);
    return { status: "error", message: "No pudimos enviar tu solicitud. Intentá de nuevo en unos minutos." };
  }

  redirect(`/students/applications/${newRequestId}`);
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/applications/types";
import { determineInitialApplicationStatus } from "@/lib/applications/roomTypeQueue";
import { MAX_REJECTION_REASON } from "@/lib/applications/inputLimits";

export type ReopenApplicationResult = { status: "ok"; newStatus: string } | { status: "error"; message: string };

/**
 * Reabrir una solicitud "trabada": rechazada por la residencia, vencida
 * sin respuesta de la residencia, o vencida por no responder una
 * propuesta de negociación a tiempo — intervención de admin (docs/12 §17
 * Fase 11: "Admin puede intervenir solicitudes trabadas, incluyendo
 * negociaciones vencidas"). `expired_offer_no_response` es un estado real
 * que genera `expireNegotiationProposals` (Ciclo 22) pero que hasta acá
 * no tenía copy en ninguna pantalla (bug preexistente, corregido en el
 * mismo commit que agrega esta reapertura). Reusa la misma lógica de cola
 * por tipo de habitación que usa una solicitud nueva (`determineInitialApplicationStatus`)
 * para no romper el invariante de 3 visibles + 2 en cola (docs/03 §10.3-10.4),
 * y respeta el máximo de 2 solicitudes activas por estudiante (docs/00 §9).
 */
const REOPENABLE_STATUSES = ["rejected", "expired_no_residence_response", "expired_offer_no_response"];

export async function reopenApplication(
  admin: SupabaseClient,
  params: { applicationId: string; actorUserId: string; actorRole: string; reason: string },
): Promise<ReopenApplicationResult> {
  const reason = params.reason.trim();
  if (reason.length < 5) return { status: "error", message: "El motivo de la reapertura es obligatorio." };
  if (reason.length > MAX_REJECTION_REASON) {
    return { status: "error", message: `El motivo no puede superar los ${MAX_REJECTION_REASON} caracteres.` };
  }

  const { data: application } = await admin
    .from("application_requests")
    .select("id, status, student_profile_id, room_type_id, residence_id, residences(name)")
    .eq("id", params.applicationId)
    .maybeSingle();
  if (!application) return { status: "error", message: "Solicitud no encontrada." };
  if (!REOPENABLE_STATUSES.includes(application.status)) {
    return { status: "error", message: "Solo se pueden reabrir solicitudes rechazadas o vencidas." };
  }

  const { count: activeCount } = await admin
    .from("application_requests")
    .select("*", { count: "exact", head: true })
    .eq("student_profile_id", application.student_profile_id)
    .in("status", ACTIVE_APPLICATION_STATUSES);
  if ((activeCount ?? 0) >= 2) {
    return { status: "error", message: "El estudiante ya tiene 2 solicitudes activas — no se puede reabrir sin cerrar otra primero." };
  }

  const next = await determineInitialApplicationStatus(admin, application.room_type_id);
  if ("error" in next) return { status: "error", message: next.error };

  const { data: reopened, error: updateError } = await admin
    .from("application_requests")
    .update({ status: next.status })
    .eq("id", application.id)
    .eq("status", application.status)
    .select("id");
  if (updateError) {
    console.error("[applications] reopenApplication update failed:", updateError);
    return { status: "error", message: "No pudimos reabrir la solicitud. Probá de nuevo." };
  }
  // Compare-and-set: si otra reapertura (u otro cambio) ganó, no se duplican eventos, auditoría ni notificación.
  if (!reopened || reopened.length === 0) {
    return { status: "error", message: "Esta solicitud ya cambió de estado. Actualizá la página." };
  }

  await admin.from("application_status_events").insert({
    application_request_id: application.id,
    from_status: application.status,
    to_status: next.status,
    changed_by_user_id: params.actorUserId,
    changed_by_role: params.actorRole,
    reason_text: reason,
  });
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "application_reopened_by_admin",
    entityType: "application_requests",
    entityId: application.id,
    oldValue: { status: application.status },
    newValue: { status: next.status },
    reasonText: reason,
    source: "admin",
  });

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("user_id")
    .eq("id", application.student_profile_id)
    .maybeSingle();
  if (studentProfile) {
    const residenceName = (application.residences as unknown as { name: string } | null)?.name ?? "la residencia";
    await createNotification(admin, {
      userId: studentProfile.user_id,
      title: "Tu solicitud fue reabierta",
      body: `El equipo de EstuRed reabrió tu solicitud a ${residenceName}. Motivo: ${reason}`,
      relatedEntityType: "application_requests",
      relatedEntityId: application.id,
    });
  }

  return { status: "ok", newStatus: next.status };
}

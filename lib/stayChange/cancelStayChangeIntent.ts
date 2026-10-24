import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { closeItemsUnderIntent, loadIntentItems } from "@/lib/stayChange/closeItemsUnderIntent";
import { GENERIC_ERROR, NOT_FOUND_ERROR, loadIntent, loadStudentByUserId } from "@/lib/stayChange/common";
import { loadActiveFamilyUserIds, loadResidenceUserIds, shortStudentName } from "@/lib/stayChange/recipients";
import { ACTIVE_STAY_CHANGE_STATUSES, STAY_CHANGE_CANCELLED_REASON } from "@/lib/stayChange/status";

export type CancelStayChangeIntentResult =
  | { ok: true; closedApplications: number; closedWaitlist: number }
  | { ok: false; error: string; blockingApplicationIds?: string[] };

/**
 * Cancelar el aviso (DR3, decisión del dueño): vuelve a regir DR1 y se CIERRAN las solicitudes (sin pago iniciado) y
 * listas de espera creadas bajo el aviso, avisando a esas residencias. Se BLOQUEA si hay una solicitud propia con pago
 * en curso (residence_payment_pending o posterior): hay que resolverla con Soporte antes. La residencia actual y el
 * familiar son notificados. Los avisos pendientes de familiar (menores) se cancelan sin avisar a la residencia.
 */
export async function cancelStayChangeIntent(
  admin: SupabaseClient,
  params: { actorUserId: string; intentId: string },
): Promise<CancelStayChangeIntentResult> {
  const student = await loadStudentByUserId(admin, params.actorUserId);
  const intent = await loadIntent(admin, params.intentId);
  if (!student || !intent || intent.student_profile_id !== student.id) return { ok: false, error: NOT_FOUND_ERROR };
  if (!ACTIVE_STAY_CHANGE_STATUSES.includes(intent.status)) {
    return { ok: false, error: "Este aviso ya estaba cerrado." };
  }

  const items = await loadIntentItems(admin, intent.id);
  if (!items) return { ok: false, error: GENERIC_ERROR };
  if (items.blockingApplications.length > 0) {
    return {
      ok: false,
      error:
        "Todavía no podés cancelar tu aviso: tenés una solicitud en etapa de pago a la residencia que se envió por tu cambio. Resolvela con Soporte antes de cancelarlo, para no quedar con dos reservas que se superponen.",
      blockingApplicationIds: items.blockingApplications.map((a) => a.id),
    };
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("stay_change_intents")
    .update({ status: "cancelled_by_student", resolved_at: nowIso })
    .eq("id", intent.id)
    .in("status", [...ACTIVE_STAY_CHANGE_STATUSES])
    .select("id");
  if (error) {
    console.error("[stayChange] cancel failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!updated?.length) return { ok: false, error: "Este aviso ya estaba cerrado." };

  // Releer tras marcar: si una solicitud llegó a pago mientras tanto, se revierte la cancelación (nunca queda una
  // solicitud en `residence_payment_pending` colgada de un aviso cancelado).
  const recheck = await loadIntentItems(admin, intent.id);
  if (!recheck || recheck.blockingApplications.length > 0) {
    await admin.from("stay_change_intents").update({ status: intent.status, resolved_at: null }).eq("id", intent.id).eq("status", "cancelled_by_student");
    return recheck
      ? {
          ok: false,
          error:
            "Todavía no podés cancelar tu aviso: tenés una solicitud en etapa de pago a la residencia que se envió por tu cambio. Resolvela con Soporte antes de cancelarlo, para no quedar con dos reservas que se superponen.",
          blockingApplicationIds: recheck.blockingApplications.map((a) => a.id),
        }
      : { ok: false, error: GENERIC_ERROR };
  }

  const name = shortStudentName(student);
  const closed = await closeItemsUnderIntent(admin, {
    intentId: intent.id,
    items,
    reason: STAY_CHANGE_CANCELLED_REASON,
    actorUserId: params.actorUserId,
    actorRole: "student",
    studentName: name,
  });

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "stay_change_intent_cancelled",
    entityType: "stay_change_intents",
    entityId: intent.id,
    oldValue: { status: intent.status },
    newValue: { status: "cancelled_by_student", closed_applications: closed.closedApplications, closed_waitlist: closed.closedWaitlist },
  });

  const entity = { relatedEntityType: "stay_change_intents", relatedEntityId: intent.id } as const;
  if (intent.status === "open") {
    for (const userId of await loadResidenceUserIds(admin, intent.current_residence_id)) {
      await createNotification(admin, {
        userId,
        title: `${name} canceló su aviso de cambio`,
        body: `${name} se queda: dejó de buscar otro lugar.`,
        ...entity,
      });
    }
  }
  for (const userId of await loadActiveFamilyUserIds(admin, student.id)) {
    await createNotification(admin, {
      userId,
      title: `${name} canceló su aviso de cambio`,
      body: "Su reserva sigue igual y vuelve el límite de fechas para nuevas solicitudes.",
      ...entity,
    });
  }
  return { ok: true, closedApplications: closed.closedApplications, closedWaitlist: closed.closedWaitlist };
}

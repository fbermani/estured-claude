import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { NOT_FOUND_ERROR, GENERIC_ERROR, loadIntent, loadStudentByUserId } from "@/lib/stayChange/common";
import { loadResidenceUserIds, shortStudentName } from "@/lib/stayChange/recipients";
import { ACTIVE_STAY_CHANGE_STATUSES, STAY_CHANGE_EDIT_NOTIFY_MINUTES, STAY_CHANGE_MAX_EDITS } from "@/lib/stayChange/status";
import { validateStudentIntentInput } from "@/lib/stayChange/validate";

export type UpdateStayChangeIntentResult = { ok: true } | { ok: false; error: string };

/**
 * El estudiante edita su aviso mientras siga vivo (fecha estimada y mensaje). Auditado con el valor
 * anterior y el nuevo; la residencia ve "Actualizado el…" (`student_edited_at`) y, si cambió la fecha o el mensaje,
 * recibe una notificación.
 */
export async function updateStayChangeIntent(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    intentId: string;
    estimatedExitDate: unknown;
    studentMessage: unknown;
  },
  now: Date = new Date(),
): Promise<UpdateStayChangeIntentResult> {
  const student = await loadStudentByUserId(admin, params.actorUserId);
  const intent = await loadIntent(admin, params.intentId);
  if (!student || !intent || intent.student_profile_id !== student.id) return { ok: false, error: NOT_FOUND_ERROR };
  if (!ACTIVE_STAY_CHANGE_STATUSES.includes(intent.status)) {
    return { ok: false, error: "Este aviso ya está cerrado. Si seguís buscando, avisá de nuevo." };
  }

  const input = validateStudentIntentInput(
    { estimatedExitDate: params.estimatedExitDate, studentMessage: params.studentMessage },
    now,
  );
  if (!input.ok) return input;
  const next = input.value;

  const changedVisibleToResidence =
    next.estimatedExitDate !== intent.estimated_exit_date || next.studentMessage !== intent.student_message;
  if (!changedVisibleToResidence) return { ok: true };

  // Límite de ediciones por aviso (se cuentan en la auditoría) y de re-notificaciones a la residencia.
  const { count: edits, error: editsError } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "stay_change_intents")
    .eq("entity_id", intent.id)
    .eq("action", "stay_change_intent_updated");
  if (editsError) {
    console.error("[stayChange] edit count failed:", editsError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if ((edits ?? 0) >= STAY_CHANGE_MAX_EDITS) {
    return { ok: false, error: `Ya editaste este aviso ${STAY_CHANGE_MAX_EDITS} veces. Si cambió algo importante, cancelalo y avisá de nuevo pasadas 24 horas.` };
  }
  const notifyEdit =
    !intent.student_edited_at || now.getTime() - new Date(intent.student_edited_at).getTime() >= STAY_CHANGE_EDIT_NOTIFY_MINUTES * 60_000;

  const { error } = await admin
    .from("stay_change_intents")
    .update({
      estimated_exit_date: next.estimatedExitDate,
      student_message: next.studentMessage,
      student_edited_at: now.toISOString(),
    })
    .eq("id", intent.id)
    .in("status", [...ACTIVE_STAY_CHANGE_STATUSES]);
  if (error) {
    console.error("[stayChange] update failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "stay_change_intent_updated",
    entityType: "stay_change_intents",
    entityId: intent.id,
    oldValue: {
      estimated_exit_date: intent.estimated_exit_date,
      student_message: intent.student_message,
    },
    newValue: {
      estimated_exit_date: next.estimatedExitDate,
      student_message: next.studentMessage,
    },
  });

  if (changedVisibleToResidence && intent.status === "open" && notifyEdit) {
    const name = shortStudentName(student);
    for (const userId of await loadResidenceUserIds(admin, intent.current_residence_id)) {
      await createNotification(admin, {
        category: "requests_reservations",
        userId,
        title: `${name} actualizó su aviso de cambio`,
        body: `Salida estimada: ${next.estimatedExitDate ?? "sin definir"}. Revisá los datos en Residentes.`,
        relatedEntityType: "stay_change_intents",
        relatedEntityId: intent.id,
      });
    }
  }
  return { ok: true };
}

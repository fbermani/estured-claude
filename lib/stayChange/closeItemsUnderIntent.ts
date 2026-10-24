import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { promoteNextQueuedApplication } from "@/lib/applications/roomTypeQueue";
import { loadResidenceUserIds } from "@/lib/stayChange/recipients";
import {
  CLOSABLE_APPLICATION_STATUSES,
  CLOSABLE_WAITLIST_STATUSES,
  PAYMENT_IN_PROGRESS_APPLICATION_STATUSES,
} from "@/lib/stayChange/status";

export type IntentItems = {
  /** Solicitudes vinculadas al aviso que se pueden cerrar (sin pago iniciado). */
  closableApplications: { id: string; residenceId: string; roomTypeId: string | null; status: string }[];
  /** Solicitudes vinculadas con pago a la residencia en curso (bloquean la cancelación). */
  blockingApplications: { id: string; status: string }[];
  /** Listas de espera vinculadas que se pueden cerrar. */
  closableWaitlist: { id: string; residenceId: string }[];
};

/** Qué cuelga del aviso (`stay_change_intent_id`). `null` si no se pudo leer. */
export async function loadIntentItems(admin: SupabaseClient, intentId: string): Promise<IntentItems | null> {
  const [apps, lists] = await Promise.all([
    admin
      .from("application_requests")
      .select("id, residence_id, room_type_id, status")
      .eq("stay_change_intent_id", intentId)
      .in("status", [...CLOSABLE_APPLICATION_STATUSES, ...PAYMENT_IN_PROGRESS_APPLICATION_STATUSES]),
    admin
      .from("waitlist_entries")
      .select("id, residence_id")
      .eq("stay_change_intent_id", intentId)
      .in("status", [...CLOSABLE_WAITLIST_STATUSES]),
  ]);
  if (apps.error || lists.error) {
    console.error("[stayChange] no se pudo leer lo creado bajo el aviso:", apps.error ?? lists.error);
    return null;
  }
  const rows = (apps.data ?? []) as { id: string; residence_id: string; room_type_id: string | null; status: string }[];
  const blocking = new Set<string>(PAYMENT_IN_PROGRESS_APPLICATION_STATUSES);
  return {
    closableApplications: rows.filter((r) => !blocking.has(r.status)).map((r) => ({ id: r.id, residenceId: r.residence_id, roomTypeId: r.room_type_id, status: r.status })),
    blockingApplications: rows.filter((r) => blocking.has(r.status)).map((r) => ({ id: r.id, status: r.status })),
    closableWaitlist: ((lists.data ?? []) as { id: string; residence_id: string }[]).map((l) => ({ id: l.id, residenceId: l.residence_id })),
  };
}

/**
 * Cierra las solicitudes (sin pago iniciado) y listas de espera creadas bajo el aviso, y avisa a ESAS residencias
 * con un texto genérico: nunca les cuenta que existía un aviso "Quiero cambiar" (privacidad entre residencias).
 * Best-effort: un fallo puntual se loggea y sigue con el resto. Devuelve cuántas cerró.
 */
export async function closeItemsUnderIntent(
  admin: SupabaseClient,
  params: {
    intentId: string;
    items: IntentItems;
    reason: string;
    actorUserId: string | null;
    actorRole: "student" | "system";
    studentName: string;
  },
): Promise<{ closedApplications: number; closedWaitlist: number }> {
  const nowIso = new Date().toISOString();
  const source = params.actorRole === "system" ? "system" : "user";
  let closedApplications = 0;
  let closedWaitlist = 0;
  const notifiedResidences = new Map<string, { apps: number; lists: number }>();
  const bump = (residenceId: string, key: "apps" | "lists") => {
    const current = notifiedResidences.get(residenceId) ?? { apps: 0, lists: 0 };
    current[key] += 1;
    notifiedResidences.set(residenceId, current);
  };

  for (const app of params.items.closableApplications) {
    const { error } = await admin
      .from("application_requests")
      .update({ status: "cancelled_by_student", cancelled_reason: params.reason })
      .eq("id", app.id)
      .in("status", [...CLOSABLE_APPLICATION_STATUSES]);
    if (error) {
      console.error("[stayChange] no se pudo cerrar la solicitud:", error);
      continue;
    }
    await admin.from("application_status_events").insert({
      application_request_id: app.id,
      from_status: app.status,
      to_status: "cancelled_by_student",
      changed_by_user_id: params.actorUserId,
      changed_by_role: params.actorRole,
      reason_code: params.reason,
    });
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "application_cancelled_stay_change",
      entityType: "application_requests",
      entityId: app.id,
      reasonCode: params.reason,
      source,
    });
    if (app.roomTypeId) await promoteNextQueuedApplication(admin, app.roomTypeId);
    closedApplications += 1;
    bump(app.residenceId, "apps");
  }

  for (const entry of params.items.closableWaitlist) {
    const { error } = await admin
      .from("waitlist_entries")
      .update({ status: "removed_by_student", removed_at: nowIso, removed_by: params.actorUserId, removed_reason: params.reason })
      .eq("id", entry.id)
      .in("status", [...CLOSABLE_WAITLIST_STATUSES]);
    if (error) {
      console.error("[stayChange] no se pudo cerrar la lista de espera:", error);
      continue;
    }
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "waitlist_entry_removed_stay_change",
      entityType: "waitlist_entries",
      entityId: entry.id,
      reasonCode: params.reason,
      source,
    });
    closedWaitlist += 1;
    bump(entry.residenceId, "lists");
  }

  for (const [residenceId, counts] of notifiedResidences) {
    const parts: string[] = [];
    if (counts.apps) parts.push(counts.apps === 1 ? "una solicitud de reserva" : `${counts.apps} solicitudes de reserva`);
    if (counts.lists) parts.push(counts.lists === 1 ? "su lugar en la lista de espera" : "sus lugares en la lista de espera");
    for (const userId of await loadResidenceUserIds(admin, residenceId)) {
      await createNotification(admin, {
        userId,
        title: "Un estudiante retiró su pedido",
        body: `${params.studentName} cerró ${parts.join(" y ")} en tu residencia.`,
      });
    }
  }

  return { closedApplications, closedWaitlist };
}

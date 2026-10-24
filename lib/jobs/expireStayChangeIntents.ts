import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { closeItemsUnderIntent, loadIntentItems } from "@/lib/stayChange/closeItemsUnderIntent";
import { INTENT_COLUMNS, type StayChangeIntentRow } from "@/lib/stayChange/common";
import { loadActiveFamilyUserIds, loadResidenceUserIds, shortStudentName } from "@/lib/stayChange/recipients";
import { ACTIVE_STAY_CHANGE_STATUSES, STAY_CHANGE_EXPIRED_REASON, STAY_CHANGE_REMINDER_DAYS_BEFORE } from "@/lib/stayChange/status";

type StudentName = { user_id: string; first_name: string | null; last_initial: string | null } | null;

async function loadStudentName(admin: SupabaseClient, studentProfileId: string): Promise<StudentName> {
  const { data } = await admin.from("student_profiles").select("user_id, first_name, last_initial").eq("id", studentProfileId).maybeSingle();
  return (data as StudentName) ?? null;
}

/**
 * Job de vencimiento del aviso "Quiero cambiar" (`docs/06` §27.11, junto a los demás jobs de `runExpirationJobs`):
 *  1. Recordatorio a los 80 días (10 antes): avisos `open` que vencen en ≤ 10 días y todavía sin recordatorio.
 *  2. Vencimiento a los 90 días: `open`/`pending_guardian_confirmation` con `expires_at` vencido → `expired`. Como la
 *     reserva vigente sigue, vuelve a regir DR1: se cierran las solicitudes (sin pago iniciado) y listas creadas bajo
 *     el aviso, igual que al cancelar (supuesto reversible: `docs/04` §12bis.4 no distingue cancelar de vencer).
 * Idempotente: filtra por estado y por `last_keep_alive_notified_at`. Nunca lanza.
 */
export async function expireStayChangeIntents(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<{ remindedCount: number; expiredCount: number }> {
  let remindedCount = 0;
  let expiredCount = 0;
  try {
    const soon = new Date(now.getTime() + STAY_CHANGE_REMINDER_DAYS_BEFORE * 86_400_000).toISOString();
    const { data: toRemind, error: remindError } = await admin
      .from("stay_change_intents")
      .select("id, student_profile_id")
      .eq("status", "open")
      .gt("expires_at", now.toISOString())
      .lte("expires_at", soon)
      .is("last_keep_alive_notified_at", null);
    if (remindError) console.error("[jobs] expireStayChangeIntents reminder query failed:", remindError);
    for (const row of toRemind ?? []) {
      const { data: marked } = await admin
        .from("stay_change_intents")
        .update({ last_keep_alive_notified_at: now.toISOString() })
        .eq("id", row.id)
        .is("last_keep_alive_notified_at", null)
        .select("id");
      if (!marked?.length) continue;
      const student = await loadStudentName(admin, row.student_profile_id as string);
      if (student?.user_id) {
        await createNotification(admin, {
          userId: student.user_id,
          title: "Tu aviso de cambio vence en 10 días",
          body: "¿Seguís buscando? Entrá a Mi residencia y confirmá que seguís buscando, o cancelá el aviso.",
          relatedEntityType: "stay_change_intents",
          relatedEntityId: row.id as string,
        });
      }
      await createAuditLog(admin, {
        actorUserId: null,
        actorRole: "system",
        action: "stay_change_intent_keep_alive_notified",
        entityType: "stay_change_intents",
        entityId: row.id as string,
        source: "system",
      });
      remindedCount += 1;
    }

    const { data: due, error: dueError } = await admin
      .from("stay_change_intents")
      .select(INTENT_COLUMNS)
      .in("status", [...ACTIVE_STAY_CHANGE_STATUSES])
      .lt("expires_at", now.toISOString());
    if (dueError) console.error("[jobs] expireStayChangeIntents expire query failed:", dueError);
    for (const intent of (due ?? []) as unknown as StayChangeIntentRow[]) {
      // Con un pago a la residencia nueva en curso vinculado al aviso, NO vence: así la confirmación de esa reserva
      // todavía puede resolverlo y avisar a la residencia actual. Se reintenta en la próxima corrida.
      const pending = await loadIntentItems(admin, intent.id);
      if (!pending || pending.blockingApplications.length > 0) continue;
      const { data: expired } = await admin
        .from("stay_change_intents")
        .update({ status: "expired", resolved_at: now.toISOString() })
        .eq("id", intent.id)
        .in("status", [...ACTIVE_STAY_CHANGE_STATUSES])
        .select("id");
      if (!expired?.length) continue;
      expiredCount += 1;

      const student = await loadStudentName(admin, intent.student_profile_id);
      const name = shortStudentName(student);
      const items = pending;
      {
        await closeItemsUnderIntent(admin, {
          intentId: intent.id,
          items,
          reason: STAY_CHANGE_EXPIRED_REASON,
          actorUserId: null,
          actorRole: "system",
          studentName: name,
        });
      }
      await createAuditLog(admin, {
        actorUserId: null,
        actorRole: "system",
        action: "stay_change_intent_expired",
        entityType: "stay_change_intents",
        entityId: intent.id,
        oldValue: { status: intent.status },
        newValue: { status: "expired" },
        source: "system",
      });

      const entity = { relatedEntityType: "stay_change_intents", relatedEntityId: intent.id } as const;
      if (student?.user_id) {
        await createNotification(admin, {
          userId: student.user_id,
          title: "Tu aviso de cambio venció",
          body: "Si seguís buscando, podés avisar de nuevo desde Mi residencia.",
          ...entity,
        });
      }
      for (const userId of await loadActiveFamilyUserIds(admin, intent.student_profile_id)) {
        await createNotification(admin, { userId, title: `El aviso de cambio de ${name} venció`, body: "Vuelve a regir el límite de fechas para nuevas solicitudes.", ...entity });
      }
      if (intent.status === "open") {
        for (const userId of await loadResidenceUserIds(admin, intent.current_residence_id)) {
          await createNotification(admin, { userId, title: `El aviso de cambio de ${name} venció`, body: `${name} no confirmó que siga buscando.`, ...entity });
        }
      }
    }
  } catch (error) {
    console.error("[jobs] expireStayChangeIntents failed:", error);
  }
  return { remindedCount, expiredCount };
}

/**
 * Salida real de la estadía (`endResidentStay`) sin reserva nueva: el aviso de ese estudiante en esa residencia pasa a
 * `expired` (`docs/04` §12bis.3). NO cierra solicitudes ni listas: sin estadía vigente ya no hay período que se
 * superponga. Nunca lanza.
 */
export async function expireStayChangeIntentsOnStayEnded(
  admin: SupabaseClient,
  params: { studentProfileId: string | null; residenceId: string },
): Promise<number> {
  if (!params.studentProfileId) return 0;
  try {
    const { data: expired, error } = await admin
      .from("stay_change_intents")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("student_profile_id", params.studentProfileId)
      .eq("current_residence_id", params.residenceId)
      .in("status", [...ACTIVE_STAY_CHANGE_STATUSES])
      .select("id, status");
    if (error) {
      console.error("[stayChange] expire on stay ended failed:", error);
      return 0;
    }
    for (const row of expired ?? []) {
      await createAuditLog(admin, {
        actorUserId: null,
        actorRole: "system",
        action: "stay_change_intent_expired_stay_ended",
        entityType: "stay_change_intents",
        entityId: row.id as string,
        newValue: { status: "expired", reason: "stay_ended" },
        source: "system",
      });
    }
    return expired?.length ?? 0;
  } catch (error) {
    console.error("[stayChange] expire on stay ended failed:", error);
    return 0;
  }
}

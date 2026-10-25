import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { sendEmail } from "@/lib/email/sendEmail";
import { loadActiveFamilyUserIds, loadResidenceUserIds, shortStudentName } from "@/lib/stayChange/recipients";
import {
  RESIDENCE_REMINDER,
  STUDENT_SURVEY,
  LIVE_STAY_STATUSES,
  computeDueAt,
  discoveryFloorDate,
  isNoResponseDue,
  isStayLive,
} from "@/lib/followups/common";

type StayRow = {
  id: string;
  residence_id: string;
  student_profile_id: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
};
type FollowupRow = {
  id: string;
  resident_stay_id: string;
  residence_id: string;
  student_profile_id: string | null;
  status: string;
  due_at: string;
  sent_at: string | null;
  survey_sent_at: string | null;
};
const FOLLOWUP_COLUMNS = "id, resident_stay_id, residence_id, student_profile_id, status, due_at, sent_at, survey_sent_at";

export type StayFollowupsResult = { scheduled: number; sent: number; cancelled: number; noResponse: number };

const STAY_COLUMNS = "id, residence_id, student_profile_id, status, start_date, end_date, is_current";

function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "PGRST205" || error.code === "42P01");
}

async function audit(admin: SupabaseClient, action: string, entityId: string, oldStatus: string | null, newStatus: string) {
  await createAuditLog(admin, {
    actorUserId: null,
    actorRole: "system",
    action,
    entityType: "stay_followup",
    entityId,
    oldValue: oldStatus ? { status: oldStatus } : undefined,
    newValue: { status: newStatus },
    source: "system",
  });
}

/**
 * Job del seguimiento post-ingreso (DR14, `docs/06` §27.12), dentro de `runExpirationJobs`. Descubre por fecha (no depende de un gancho
 * en cada flujo que activa una estadía) y es idempotente en cada paso:
 *  1. Programa (`scheduled`, `due_at = start_date + 5 días`) las estadías vigentes con `start_date` que no tienen seguimiento (unique por estadía).
 *  2. Cancela los `scheduled` cuya estadía se cerró antes de `due_at`.
 *  3. Con `due_at <= now` y estadía vigente: reclama el paso (update condicionado a `scheduled`) → `sent`, avisa a la residencia
 *     (quien tiene `residents.manage`; SIN estado ni respuestas) y envía la encuesta al estudiante (y al guardián si es menor).
 *  4. `sent` hace 14 días sin respuesta → `no_response`.
 * Nunca lanza. Sin la migración 0055 devuelve ceros.
 */
export async function runStayFollowups(admin: SupabaseClient, now: Date = new Date()): Promise<StayFollowupsResult> {
  const result: StayFollowupsResult = { scheduled: 0, sent: 0, cancelled: 0, noResponse: 0 };
  try {
    const probe = await admin.from("stay_followups").select("id").limit(1);
    if (probe.error) {
      if (!isMissingTable(probe.error)) console.error("[jobs] runStayFollowups probe failed:", probe.error);
      return result;
    }

    // 1. Programar.
    const { data: candidates, error: candError } = await admin
      .from("resident_stays")
      .select(STAY_COLUMNS)
      .gte("start_date", discoveryFloorDate(now));
    if (candError) console.error("[jobs] runStayFollowups candidates failed:", candError);
    const live = ((candidates ?? []) as StayRow[]).filter(
      (s) => !!s.start_date && (LIVE_STAY_STATUSES as readonly string[]).includes(s.status) && isStayLive(s, now),
    );
    if (live.length) {
      const { data: existing, error: existingError } = await admin
        .from("stay_followups")
        .select("resident_stay_id")
        .in("resident_stay_id", live.map((s) => s.id));
      if (existingError) {
        // Sin saber cuáles existen no se programa nada en esta pasada (el unique igual evitaría duplicados).
        console.error("[jobs] runStayFollowups existing query failed:", existingError);
      } else {
        const have = new Set((existing ?? []).map((r) => r.resident_stay_id as string));
        for (const stay of live) {
          if (have.has(stay.id)) continue;
          const due = computeDueAt(stay.start_date as string);
          if (!due) continue;
          const { data: created, error } = await admin
            .from("stay_followups")
            .insert({
              resident_stay_id: stay.id,
              residence_id: stay.residence_id,
              student_profile_id: stay.student_profile_id,
              status: "scheduled",
              due_at: due.toISOString(),
            })
            .select("id")
            .maybeSingle();
          if (error) {
            if (error.code !== "23505") console.error("[jobs] runStayFollowups schedule failed:", error);
            continue;
          }
          if (created?.id) {
            result.scheduled += 1;
            await audit(admin, "stay_followup_scheduled", created.id as string, null, "scheduled");
          }
        }
      }
    }

    // 2 y 3. Procesar los programados.
    const { data: scheduledRows, error: scheduledError } = await admin
      .from("stay_followups")
      .select(FOLLOWUP_COLUMNS)
      .eq("status", "scheduled");
    if (scheduledError) console.error("[jobs] runStayFollowups scheduled query failed:", scheduledError);
    else {
      for (const followup of (scheduledRows ?? []) as FollowupRow[]) {
        const { data: stayData, error: stayError } = await admin.from("resident_stays").select(STAY_COLUMNS).eq("id", followup.resident_stay_id).maybeSingle();
        if (stayError) {
          // Un error de lectura NO es "la estadía no existe": no se cancela nada.
          console.error("[jobs] runStayFollowups stay read failed:", stayError);
          continue;
        }
        const stay = stayData as StayRow | null;
        if (!stay || !isStayLive(stay, now)) {
          const { data: cancelled } = await admin
            .from("stay_followups")
            .update({ status: "cancelled" })
            .eq("id", followup.id)
            .eq("status", "scheduled")
            .select("id");
          if (cancelled?.length) {
            result.cancelled += 1;
            await audit(admin, "stay_followup_cancelled", followup.id, "scheduled", "cancelled");
          }
          continue;
        }
        // La estadía sin cuenta que después se vincula: el seguimiento toma al estudiante para que reciba la encuesta.
        if (!followup.student_profile_id && stay.student_profile_id) {
          const { error: syncError } = await admin.from("stay_followups").update({ student_profile_id: stay.student_profile_id }).eq("id", followup.id);
          if (syncError) console.error("[jobs] runStayFollowups sync profile failed:", syncError);
          else followup.student_profile_id = stay.student_profile_id;
        }
        if (new Date(followup.due_at).getTime() > now.getTime()) continue;

        const { data: claimed } = await admin
          .from("stay_followups")
          .update({ status: "sent", sent_at: now.toISOString() })
          .eq("id", followup.id)
          .eq("status", "scheduled")
          .select("id");
        if (!claimed?.length) continue;
        // Se audita ANTES de entregar; si la entrega falla se revierte a `scheduled` y el job la reintenta.
        await audit(admin, "stay_followup_sent", followup.id, "scheduled", "sent");
        const delivered = await deliver(admin, followup, stay, now).catch((error) => {
          console.error("[jobs] runStayFollowups deliver failed:", error);
          return false;
        });
        if (!delivered) {
          await admin.from("stay_followups").update({ status: "scheduled", sent_at: null }).eq("id", followup.id).eq("status", "sent");
          await audit(admin, "stay_followup_delivery_failed", followup.id, "sent", "scheduled");
          continue;
        }
        result.sent += 1;
      }
    }

    // 4. Sin respuesta (y encuesta tardía para estadías que se vincularon a una cuenta después del aviso).
    const { data: sentRows, error: sentError } = await admin.from("stay_followups").select(FOLLOWUP_COLUMNS).eq("status", "sent");
    if (sentError) console.error("[jobs] runStayFollowups sent query failed:", sentError);
    else {
      for (const followup of (sentRows ?? []) as FollowupRow[]) {
        if (!followup.student_profile_id && !followup.survey_sent_at) {
          const { data: stayData } = await admin.from("resident_stays").select(STAY_COLUMNS).eq("id", followup.resident_stay_id).maybeSingle();
          const stay = stayData as StayRow | null;
          if (stay?.student_profile_id && isStayLive(stay, now)) {
            const { error: syncError } = await admin.from("stay_followups").update({ student_profile_id: stay.student_profile_id }).eq("id", followup.id);
            if (!syncError) {
              followup.student_profile_id = stay.student_profile_id;
              await sendSurvey(admin, followup, stay, now).catch((error) => console.error("[jobs] runStayFollowups late survey failed:", error));
            }
          }
        }
        if (!isNoResponseDue(followup.sent_at, now)) continue;
        const { data: done } = await admin
          .from("stay_followups")
          .update({ status: "no_response" })
          .eq("id", followup.id)
          .eq("status", "sent")
          .select("id");
        if (done?.length) {
          result.noResponse += 1;
          await audit(admin, "stay_followup_no_response", followup.id, "sent", "no_response");
        }
      }
    }
  } catch (error) {
    console.error("[jobs] runStayFollowups failed:", error);
  }
  return result;
}

/** Aviso a la residencia + encuesta. Devuelve false si no se pudo leer lo necesario (el job revierte y reintenta). */
async function deliver(admin: SupabaseClient, followup: FollowupRow, stay: StayRow, now: Date): Promise<boolean> {
  let name = "Un residente";
  if (stay.student_profile_id) {
    const { data: profile, error } = await admin.from("student_profiles").select("first_name, last_initial").eq("id", stay.student_profile_id).maybeSingle();
    if (error) return false;
    if (profile) name = shortStudentName(profile as { first_name: string | null; last_initial: string | null });
  }

  // Aviso a la residencia: SOLO recordatorio. Se liga a la estadía (no al seguimiento) para no exponer su id ni su estado.
  for (const userId of await loadResidenceUserIds(admin, followup.residence_id)) {
    await createNotification(admin, {
      userId,
      title: RESIDENCE_REMINDER.title,
      body: RESIDENCE_REMINDER.body(name),
      relatedEntityType: "resident_stays",
      relatedEntityId: stay.id,
    });
  }
  const { error: patchError } = await admin.from("stay_followups").update({ residence_reminder_sent_at: now.toISOString() }).eq("id", followup.id);
  if (patchError) console.error("[jobs] runStayFollowups reminder patch failed:", patchError);
  await sendSurvey(admin, followup, stay, now);
  return true;
}

/** Encuesta: estudiante (si hay cuenta) y, si es menor, su guardián vinculado activo. */
async function sendSurvey(admin: SupabaseClient, followup: FollowupRow, stay: StayRow, now: Date): Promise<void> {
  if (!stay.student_profile_id) return;
  const { data: profile } = await admin
    .from("student_profiles")
    .select("user_id, first_name, last_initial, is_minor")
    .eq("id", stay.student_profile_id)
    .maybeSingle();
  if (!profile?.user_id) return;
  const name = shortStudentName(profile as { first_name: string | null; last_initial: string | null });
  const entity = { relatedEntityType: "stay_followups", relatedEntityId: followup.id } as const;
  const surveyUsers: { userId: string; guardian: boolean }[] = [{ userId: profile.user_id as string, guardian: false }];
  if (profile.is_minor === true) {
    for (const userId of await loadActiveFamilyUserIds(admin, stay.student_profile_id)) surveyUsers.push({ userId, guardian: true });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  for (const target of surveyUsers) {
    const title = target.guardian ? STUDENT_SURVEY.guardianTitle(name) : STUDENT_SURVEY.title;
    const body = target.guardian ? STUDENT_SURVEY.guardianBody : STUDENT_SURVEY.body;
    await createNotification(admin, { userId: target.userId, title, body, ...entity });
    const { data: user } = await admin.from("users").select("email").eq("id", target.userId).maybeSingle();
    if (user?.email) {
      const link = `${appUrl}/students/followup/${followup.id}`;
      await sendEmail({
        to: user.email as string,
        subject: title,
        html: `<p>${body}</p><p><a href="${link}">Responder la encuesta</a></p><p>Si necesitás ayuda con algo, escribile a Soporte.</p>`,
      });
    }
  }
  await admin.from("stay_followups").update({ survey_sent_at: now.toISOString() }).eq("id", followup.id);
}

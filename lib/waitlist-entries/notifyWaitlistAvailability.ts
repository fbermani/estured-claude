import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import {
  planNotifyBatch,
  notifiedColumns,
  type BatchEntry,
  type BatchSkip,
} from "@/lib/waitlist-entries/board";

export type NotifyWaitlistBatchResult =
  | { ok: true; notified: number; failed: BatchSkip[]; skipped: BatchSkip[]; withoutNotification: BatchSkip[] }
  | { ok: false; error: string };

export type NotifyWaitlistAvailabilityResult = { ok: true } | { ok: false; error: string };

/** Postgres «undefined_column» / PostgREST «columna no está en el schema cache»: la migración 0079 todavía no se aplicó. */
function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist/i.test(error.message ?? "");
}

/**
 * Docs/06 §27.8 + DR41 — la residencia avisa «hay lugar» a una o varias entradas de su lista de espera (tope 50 por lote).
 * Permiso `waitlist.manage` validado acá (server-side). Un aviso in-app por estudiante (sin proveedor de email todavía: docs/00 §29)
 * y una auditoría por entrada. Resultado parcial: cuántos salieron, cuáles fallaron y cuáles se ignoraron (no avisables).
 * Solo `active` / `retention_check_sent`; al avisar se limpia la marca «Decidió esperar».
 */
export async function notifyWaitlistBatch(
  admin: SupabaseClient,
  params: { residenceId: string; waitlistEntryIds: unknown; actorUserId: string },
): Promise<NotifyWaitlistBatchResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "waitlist.manage");
  if (!access.ok) return { ok: false, error: access.error };

  // Validación previa de tamaño/forma con lo pedido (sin filas todavía) para no consultar con listas enormes.
  const pre = planNotifyBatch(params.waitlistEntryIds, []);
  if (!pre.ok) return { ok: false, error: pre.error };

  const { data: found, error: readError } = await admin
    .from("waitlist_entries")
    .select("id, status, desired_start_date, student_profile_id, room_type_id")
    .eq("residence_id", params.residenceId)
    .in("id", pre.plan.ids);
  if (readError) {
    console.error("[waitlist] notifyWaitlistBatch read failed:", readError);
    return { ok: false, error: "No pudimos leer la lista. Intentá de nuevo." };
  }
  const rows = (found ?? []) as (BatchEntry & { student_profile_id: string; room_type_id: string | null })[];

  const planned = planNotifyBatch(params.waitlistEntryIds, rows);
  if (!planned.ok) return { ok: false, error: planned.error };
  const { eligible, skipped } = planned.plan;

  const [{ data: residence }, { data: profiles }, { data: types }] = await Promise.all([
    admin.from("residences").select("name").eq("id", params.residenceId).maybeSingle(),
    admin
      .from("student_profiles")
      .select("id, user_id")
      .in("id", rows.map((r) => r.student_profile_id)),
    admin.from("room_types").select("id, name").eq("residence_id", params.residenceId),
  ]);
  const userByProfile = new Map((profiles ?? []).map((p) => [p.id as string, p.user_id as string]));
  const typeName = new Map((types ?? []).map((t) => [t.id as string, t.name as string]));
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const residenceName = (residence?.name as string | undefined) ?? "la residencia";

  const failed: BatchSkip[] = [];
  const withoutNotification: BatchSkip[] = [];
  let notified = 0;
  for (const entry of eligible) {
    const row = rowById.get(entry.id)!;
    const nowIso = new Date().toISOString();
    // Guardado por estado: si otro aviso/decisión se cruzó, no pisa (0 filas = ya cambió).
    let update = await admin
      .from("waitlist_entries")
      .update({ status: "availability_notification_sent", ...notifiedColumns(nowIso) })
      .eq("id", entry.id)
      .eq("status", entry.status)
      .select("id");
    if (update.error && isMissingColumn(update.error)) {
      update = await admin
        .from("waitlist_entries")
        .update({ status: "availability_notification_sent" })
        .eq("id", entry.id)
        .eq("status", entry.status)
        .select("id");
    }
    if (update.error) {
      console.error("[waitlist] notifyWaitlistBatch update failed:", update.error);
      failed.push({ entryId: entry.id, reason: "No pudimos registrar el aviso." });
      continue;
    }
    if ((update.data ?? []).length === 0) {
      failed.push({ entryId: entry.id, reason: "La entrada cambió mientras tanto." });
      continue;
    }
    notified += 1;

    const studentUserId = userByProfile.get(row.student_profile_id);
    const roomName = row.room_type_id ? typeName.get(row.room_type_id) : null;
    // Inserción directa (no `createNotification`, que traga el error): si falla el aviso, la entrada ya quedó marcada y se informa.
    const notifError = studentUserId
      ? (
          await admin.from("notifications").insert({
            user_id: studentUserId,
            title: `${residenceName} te avisó que hay lugar`,
            body: `${roomName ? `Habitación ${roomName}. ` : ""}Entrá a tu lista de espera y elegí: enviar solicitud (queda sujeta a confirmación de la residencia), seguir esperando o salir de la lista.`,
            related_entity_type: "waitlist_entries",
            related_entity_id: entry.id,
          })
        ).error
      : { message: "sin usuario" };
    if (notifError) {
      console.error("[waitlist] notifyWaitlistBatch notification failed:", entry.id, notifError.message);
      withoutNotification.push({ entryId: entry.id, reason: "Quedó marcada como avisada pero no pudimos mandarle la notificación." });
    }
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: access.actorRole,
      action: "waitlist_availability_notified",
      entityType: "waitlist_entries",
      entityId: entry.id,
      newValue: { batch_size: eligible.length },
    });
  }

  return { ok: true, notified, failed, skipped, withoutNotification };
}

/** Aviso a una sola entrada: lote de uno. */
export async function notifyWaitlistAvailability(
  admin: SupabaseClient,
  params: { waitlistEntryId: string; actorUserId: string },
): Promise<NotifyWaitlistAvailabilityResult> {
  const { data: entry } = await admin
    .from("waitlist_entries")
    .select("id, residence_id")
    .eq("id", params.waitlistEntryId)
    .maybeSingle();
  if (!entry) return { ok: false, error: "No encontramos esa entrada de lista de espera." };

  const result = await notifyWaitlistBatch(admin, {
    residenceId: entry.residence_id,
    waitlistEntryIds: [entry.id],
    actorUserId: params.actorUserId,
  });
  if (!result.ok) return { ok: false, error: result.error };
  if (result.notified === 1) return { ok: true };
  const reason = [...result.failed, ...result.skipped][0]?.reason ?? "No pudimos avisar.";
  return { ok: false, error: reason };
}

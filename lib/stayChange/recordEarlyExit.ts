import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { DEPOSIT_STATUS_LABELS, UNPAID_DISCLAIMER, type DepositReturnStatus } from "@/lib/stayChange/copy";
import { loadActiveFamilyUserIds } from "@/lib/stayChange/recipients";
import { MAX_EXIT_STUDENT_NOTE, validateEarlyExitRecord } from "@/lib/stayChange/validate";

/**
 * Salida anticipada (DR3, aclaración del dueño 2026-10-23): la SALIDA SIEMPRE LA INICIA LA RESIDENCIA ACTUAL. "Quiero
 * cambiar" es solo un aviso del estudiante; la baja efectiva la registra la residencia con `endResidentStay` (motivo
 * `early_exit`): fecha real, devolución del depósito (devuelto / no devuelto / sin depósito) y una nota libre. El
 * estudiante puede dejar su propia nota después. Con eso la reserva queda `completed`. Si no hubo depósito, la
 * residencia es responsable de haber cobrado lo que correspondía ANTES de la salida: EstuRed no responde por
 * mensualidades impagas (texto en `copy.ts`, también en la notificación de cierre).
 */

export type EarlyExitInput = { exitDate: unknown; depositStatus: unknown; residenceNote: unknown };

export type PreparedEarlyExit = {
  exitDate: string;
  depositStatus: DepositReturnStatus;
  residenceNote: string | null;
  depositUsd: number | null;
  reservationId: string | null;
};

type StayForExit = { id: string; residence_id: string; reservation_id: string | null };

/** Valida el cierre y averigua si la reserva tenía depósito (snapshot). Nada se escribe acá. */
export async function prepareEarlyExit(
  admin: SupabaseClient,
  stay: StayForExit,
  input: EarlyExitInput,
): Promise<{ ok: true; value: PreparedEarlyExit } | { ok: false; error: string }> {
  let hadDeposit: boolean | null = null;
  let depositUsd: number | null = null;
  if (stay.reservation_id) {
    const { data, error } = await admin
      .from("reservations")
      .select("application_snapshots(deposit_usd)")
      .eq("id", stay.reservation_id)
      .maybeSingle();
    if (error) {
      console.error("[stayChange] early exit: no se pudo leer el depósito:", error);
      return { ok: false, error: "No pudimos verificar el depósito de la reserva. Intentá de nuevo." };
    }
    const snapshot = (data as unknown as { application_snapshots: { deposit_usd: number | string | null } | null } | null)?.application_snapshots;
    depositUsd = snapshot?.deposit_usd != null ? Number(snapshot.deposit_usd) : null;
    hadDeposit = depositUsd !== null && depositUsd > 0;
  }
  const checked = validateEarlyExitRecord(input, { hadDeposit });
  if (!checked.ok) return checked;
  return { ok: true, value: { ...checked.value, depositUsd: hadDeposit ? depositUsd : null, reservationId: stay.reservation_id } };
}

/**
 * Guarda el registro de la salida anticipada ANTES de cerrar la estadía (si falla, la estadía NO se cierra y la
 * residencia ve el error y reintenta). Devuelve el id del aviso vinculado. `rollbackEarlyExitRecord` lo deshace si el
 * cierre de la estadía falla después.
 */
export async function saveEarlyExitRecord(
  admin: SupabaseClient,
  params: { stay: StayForExit & { student_profile_id: string | null }; actorUserId: string; prepared: PreparedEarlyExit },
): Promise<{ ok: true; intentId: string | null } | { ok: false; error: string }> {
  const { stay, prepared } = params;
  let intentId: string | null = null;
  if (stay.student_profile_id) {
    const { data: intent } = await admin
      .from("stay_change_intents")
      .select("id")
      .eq("student_profile_id", stay.student_profile_id)
      .eq("current_residence_id", stay.residence_id)
      .in("status", ["open", "resolved_new_reservation"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    intentId = (intent?.id as string | undefined) ?? null;
  }
  const { error } = await admin.from("stay_early_exits").upsert(
    {
      resident_stay_id: stay.id,
      residence_id: stay.residence_id,
      student_profile_id: stay.student_profile_id,
      stay_change_intent_id: intentId,
      exit_type: "early_exit",
      exit_date: prepared.exitDate,
      deposit_status: prepared.depositStatus,
      deposit_usd: prepared.depositUsd,
      residence_note: prepared.residenceNote,
      recorded_by_user_id: params.actorUserId,
    },
    { onConflict: "resident_stay_id" },
  );
  if (error) {
    console.error("[stayChange] no se pudo guardar la salida anticipada:", error);
    return { ok: false, error: "No pudimos guardar el registro de la salida (depósito y nota). La estadía no se cerró: intentá de nuevo." };
  }
  return { ok: true, intentId };
}

export async function rollbackEarlyExitRecord(admin: SupabaseClient, residentStayId: string): Promise<void> {
  const { error } = await admin.from("stay_early_exits").delete().eq("resident_stay_id", residentStayId);
  if (error) console.error("[stayChange] no se pudo deshacer el registro de salida:", error);
}

/**
 * Después de cerrar la estadía: reserva → `completed`, auditoría y notificaciones. Devuelve `false` si algo falló
 * (loggeado) para que el llamador avise a la residencia.
 */
export async function finalizeEarlyExit(
  admin: SupabaseClient,
  params: { stay: StayForExit & { student_profile_id: string | null }; actorUserId: string; prepared: PreparedEarlyExit; intentId: string | null },
): Promise<boolean> {
  try {
    const { stay, prepared } = params;
    const intentId = params.intentId;
    // La reserva queda finalizada (docs/04 §7: `completed` = "la estadía inicial finalizó o fue cerrada").
    if (prepared.reservationId) {
      await admin
        .from("reservations")
        .update({ status: "completed" })
        .eq("id", prepared.reservationId)
        .in("status", ["confirmed", "receipt_pending", "receipt_issued"]);
    }

    const { data: membership } = await admin
      .from("residence_users")
      .select("role")
      .eq("residence_id", stay.residence_id)
      .eq("user_id", params.actorUserId)
      .eq("is_active", true)
      .maybeSingle();
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: membership?.role === "staff" ? "residence_staff" : "residence_owner",
      action: "resident_stay_early_exit_recorded",
      entityType: "resident_stays",
      entityId: stay.id,
      newValue: {
        exit_date: prepared.exitDate,
        deposit_status: prepared.depositStatus,
        has_residence_note: !!prepared.residenceNote,
        stay_change_intent_id: intentId,
      },
    });

    if (stay.student_profile_id) {
      const { data: student } = await admin.from("student_profiles").select("user_id, first_name").eq("id", stay.student_profile_id).maybeSingle();
      const when = formatDateOnly(prepared.exitDate);
      const body = `Tu residencia registró tu salida el ${when}. ${DEPOSIT_STATUS_LABELS[prepared.depositStatus]}. Podés dejar tu propia nota. ${UNPAID_DISCLAIMER}`;
      if (student?.user_id) {
        await createNotification(admin, {
          userId: student.user_id as string,
          title: "Tu residencia registró tu salida",
          body,
          relatedEntityType: "stay_early_exits",
        });
      }
      const name = (student?.first_name as string | undefined) ?? "Tu familiar";
      for (const userId of await loadActiveFamilyUserIds(admin, stay.student_profile_id)) {
        await createNotification(admin, {
          userId,
          title: `La residencia de ${name} registró su salida`,
          body: `Salida el ${when}. ${DEPOSIT_STATUS_LABELS[prepared.depositStatus]}.`,
          relatedEntityType: "stay_early_exits",
        });
      }
    }
    return true;
  } catch (error) {
    console.error("[stayChange] finalizeEarlyExit failed:", error);
    return false;
  }
}

/** El estudiante deja (o edita) su propia nota sobre su salida anticipada. Solo sobre SU salida ya registrada. */
export async function saveStudentExitNote(
  admin: SupabaseClient,
  params: { actorUserId: string; residentStayId: string; note: unknown },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const note = typeof params.note === "string" ? params.note.trim() : "";
  if (note.length > MAX_EXIT_STUDENT_NOTE) {
    return { ok: false, error: `La nota puede tener hasta ${MAX_EXIT_STUDENT_NOTE} caracteres.` };
  }
  const { data: student } = await admin.from("student_profiles").select("id").eq("user_id", params.actorUserId).maybeSingle();
  if (!student) return { ok: false, error: "No encontramos tu perfil de estudiante." };
  const { data: updated, error } = await admin
    .from("stay_early_exits")
    .update({ student_note: note || null, student_note_updated_at: new Date().toISOString() })
    .eq("resident_stay_id", params.residentStayId)
    .eq("student_profile_id", student.id)
    .select("id, residence_id");
  if (error) {
    console.error("[stayChange] student exit note failed:", error);
    return { ok: false, error: "No pudimos guardar tu nota. Intentá de nuevo en unos minutos." };
  }
  if (!updated?.length) return { ok: false, error: "No encontramos esa salida." };
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "stay_early_exit_student_note_saved",
    entityType: "stay_early_exits",
    entityId: updated[0].id as string,
    newValue: { has_note: !!note },
  });
  return { ok: true };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidenceAccess } from "@/lib/residences/access";
import { incrementAvailabilityOnRelease } from "@/lib/availability/incrementAvailabilityOnRelease";
import { expireStayChangeIntentsOnStayEnded } from "@/lib/jobs/expireStayChangeIntents";
import { finalizeEarlyExit, prepareEarlyExit, rollbackEarlyExitRecord, saveEarlyExitRecord, type EarlyExitInput, type PreparedEarlyExit } from "@/lib/stayChange/recordEarlyExit";

export type EndResidentStayResult = { ok: true; warning?: string } | { ok: false; error: string };

/**
 * Docs/06 §15.1 — la residencia marca que un residente ya no está (mudanza, fin de estadía).
 *
 * `earlyExit` (DR3, Ciclo 59): salida anticipada. La baja SIEMPRE la registra la residencia actual; exige fecha real y
 * devolución del depósito, deja una nota libre y finaliza la reserva (`stay_early_exits`, `lib/stayChange/recordEarlyExit.ts`).
 * El texto "EstuRed no se responsabiliza por mensualidades impagas…" viaja en la notificación de cierre.
 */
export async function endResidentStay(
  admin: SupabaseClient,
  params: { actorUserId: string; residentStayId: string; endDate: string | null; earlyExit?: EarlyExitInput },
): Promise<EndResidentStayResult> {
  const { data: stay } = await admin
    .from("resident_stays")
    .select("id, residence_id, is_current, room_type_id, student_profile_id, reservation_id")
    .eq("id", params.residentStayId)
    .maybeSingle();
  if (!stay) return { ok: false, error: "No encontramos esa estadía." };

  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, stay.residence_id);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };
  if (!stay.is_current) return { ok: false, error: "Esa estadía ya está cerrada." };

  let preparedExit: PreparedEarlyExit | null = null;
  if (params.earlyExit) {
    const prepared = await prepareEarlyExit(admin, stay, params.earlyExit);
    if (!prepared.ok) return prepared;
    preparedExit = prepared.value;
  }

  const exitStay = { id: stay.id, residence_id: stay.residence_id, reservation_id: stay.reservation_id ?? null, student_profile_id: (stay.student_profile_id as string | null) ?? null };
  // Salida anticipada: el registro (depósito y nota) se guarda ANTES de cerrar; si falla, no se cierra nada.
  let intentId: string | null = null;
  if (preparedExit) {
    const saved = await saveEarlyExitRecord(admin, { stay: exitStay, actorUserId: params.actorUserId, prepared: preparedExit });
    if (!saved.ok) return saved;
    intentId = saved.intentId;
  }

  const { error } = await admin
    .from("resident_stays")
    .update({ status: "inactive", is_current: false, end_date: preparedExit?.exitDate ?? params.endDate ?? new Date().toISOString().slice(0, 10) })
    .eq("id", params.residentStayId);
  if (error) {
    console.error("[residents] endResidentStay update failed:", error);
    if (preparedExit) await rollbackEarlyExitRecord(admin, stay.id);
    return { ok: false, error: "No pudimos cerrar la estadía. Intentá de nuevo." };
  }

  // La plaza que deja este residente vuelve a estar disponible (Ciclo 41 —
  // antes no había ninguna reposición automática de profile_availability).
  if (stay.room_type_id) {
    await incrementAvailabilityOnRelease(admin, stay.room_type_id);
  }

  // Salida anticipada: se registra ANTES de vencer el aviso (para vincularlo) y deja la reserva finalizada.
  let warning: string | undefined;
  if (preparedExit) {
    const finished = await finalizeEarlyExit(admin, { stay: exitStay, actorUserId: params.actorUserId, prepared: preparedExit, intentId });
    if (!finished) {
      warning =
        "La estadía se cerró y el depósito quedó registrado, pero no pudimos finalizar la reserva ni enviar todos los avisos. Escribí a Soporte para que lo completen.";
    }
  }

  // DR3: si el residente tenía un aviso "Quiero cambiar" vivo en esta residencia, vence al registrarse la salida real.
  await expireStayChangeIntentsOnStayEnded(admin, {
    studentProfileId: (stay.student_profile_id as string | null) ?? null,
    residenceId: stay.residence_id,
  });

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "residence_owner",
    action: "resident_stay_ended",
    entityType: "resident_stays",
    entityId: params.residentStayId,
  });

  return warning ? { ok: true, warning } : { ok: true };
}

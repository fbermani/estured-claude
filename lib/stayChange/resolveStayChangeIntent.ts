import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { INTENT_COLUMNS, type StayChangeIntentRow } from "@/lib/stayChange/common";
import { loadActiveFamilyUserIds, loadResidenceUserIds, shortStudentName } from "@/lib/stayChange/recipients";

/**
 * Se confirmó una reserva nueva del estudiante (`confirmReservationAfterFeePaid`): si tenía un aviso `open` y la
 * reserva es en OTRA residencia (y no es la propia reserva vigente del aviso), el aviso pasa a
 * `resolved_new_reservation` y se guarda `resolved_reservation_id` + `resolved_new_start_date`.
 *
 * - La residencia actual recibe SOLO la fecha de ingreso a la nueva, sin nombrarla (decisión del dueño).
 * - NO cierra la estadía ni libera la plaza (D11): la residencia registra la salida ("Registrar salida").
 * - DR2 (anular listas de espera) corre aparte, en `removeWaitlistEntriesOnConfirmedReservation`.
 *
 * Nunca lanza (mismo criterio que `createAuditLog`): no debe poder tumbar la confirmación real de la reserva.
 * Devuelve el id del aviso resuelto, o `null` si no había nada que resolver.
 */
export async function resolveStayChangeIntentOnReservation(
  admin: SupabaseClient,
  params: { studentProfileId: string; newReservationId: string; newResidenceId: string; newStartDate: string | null; newApplicationId?: string | null },
): Promise<string | null> {
  try {
    // Si la solicitud de la reserva nueva quedó vinculada a un aviso, ese aviso se resuelve aunque haya vencido
    // mientras el pago estaba en curso; si no, el aviso `open` del estudiante.
    let linkedIntentId: string | null = null;
    if (params.newApplicationId) {
      const { data: app } = await admin.from("application_requests").select("stay_change_intent_id").eq("id", params.newApplicationId).maybeSingle();
      linkedIntentId = (app?.stay_change_intent_id as string | null | undefined) ?? null;
    }
    let intentQuery = admin.from("stay_change_intents").select(INTENT_COLUMNS).eq("student_profile_id", params.studentProfileId);
    intentQuery = linkedIntentId ? intentQuery.eq("id", linkedIntentId).in("status", ["open", "expired"]) : intentQuery.eq("status", "open");
    const { data, error } = await intentQuery.maybeSingle();
    if (error) {
      console.error("[stayChange] resolve read failed:", error);
      return null;
    }
    const intent = data as unknown as StayChangeIntentRow | null;
    if (!intent) return null;
    if (intent.current_residence_id === params.newResidenceId || intent.reservation_id === params.newReservationId) return null;

    const { data: updated, error: updateError } = await admin
      .from("stay_change_intents")
      .update({
        status: "resolved_new_reservation",
        resolved_reservation_id: params.newReservationId,
        resolved_new_start_date: params.newStartDate,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", intent.id)
      .in("status", ["open", "expired"])
      .select("id");
    if (updateError || !updated?.length) {
      if (updateError) console.error("[stayChange] resolve update failed:", updateError);
      return null;
    }

    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "stay_change_intent_resolved",
      entityType: "stay_change_intents",
      entityId: intent.id,
      oldValue: { status: intent.status },
      newValue: { status: "resolved_new_reservation", resolved_reservation_id: params.newReservationId, resolved_new_start_date: params.newStartDate },
      source: "system",
    });

    const { data: student } = await admin
      .from("student_profiles")
      .select("user_id, first_name, last_initial")
      .eq("id", intent.student_profile_id)
      .maybeSingle();
    const name = shortStudentName(student as { first_name: string | null; last_initial: string | null } | null);
    const when = params.newStartDate ? formatDateOnly(params.newStartDate) : null;
    const entity = { relatedEntityType: "stay_change_intents", relatedEntityId: intent.id } as const;

    for (const userId of await loadResidenceUserIds(admin, intent.current_residence_id)) {
      await createNotification(admin, {
        userId,
        title: `${name} tiene una reserva confirmada en otra residencia`,
        body: when
          ? `Este estudiante tiene una reserva confirmada a partir de ${when} en otra residencia. Cuando se retire, registrá su salida anticipada.`
          : "Este estudiante tiene una reserva confirmada en otra residencia. Cuando se retire, registrá su salida anticipada.",
        ...entity,
      });
    }
    if (student?.user_id) {
      await createNotification(admin, {
        userId: student.user_id as string,
        title: "Tu aviso de cambio se resolvió",
        body: "Tu residencia actual ya sabe la fecha de tu ingreso al nuevo lugar. Coordiná tu salida con ella: ver lo que te informó.",
        ...entity,
      });
    }
    for (const userId of await loadActiveFamilyUserIds(admin, intent.student_profile_id)) {
      await createNotification(admin, {
        userId,
        title: `${name} confirmó su nuevo lugar`,
        body: when ? `Ingresa el ${when}. Su residencia actual registra la salida.` : "Su residencia actual registra la salida.",
        ...entity,
      });
    }
    return intent.id;
  } catch (error) {
    console.error("[stayChange] resolve failed:", error);
    return null;
  }
}

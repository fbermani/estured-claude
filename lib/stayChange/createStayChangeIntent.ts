import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { loadStayChangeEligibility } from "@/lib/stayChange/eligibility";
import { loadActiveFamilyUserIds, loadResidenceUserIds, shortStudentName } from "@/lib/stayChange/recipients";
import { GENERIC_ERROR, loadStudentByUserId } from "@/lib/stayChange/common";
import { advanceUnlockAt } from "@/lib/stayChange/advanceGate";
import { UNPAID_DISCLAIMER } from "@/lib/stayChange/copy";
import { STAY_CHANGE_CREATE_COOLDOWN_HOURS, stayChangeExpiryFrom } from "@/lib/stayChange/status";
import { validateStudentIntentInput } from "@/lib/stayChange/validate";

export type CreateStayChangeIntentResult =
  | { ok: true; intentId: string; status: "open" | "pending_guardian_confirmation" }
  | { ok: false; error: string };

/**
 * "Quiero cambiar" (DR3, `docs/04` §12bis.3): el estudiante avisa a su residencia actual que busca otro lugar.
 *
 * - Exige la confirmación explícita (checkbox) y estadía/reserva vigente; bloquea con renovación aceptada en curso.
 * - Menores: el aviso queda `pending_guardian_confirmation` (NO se envía a la residencia ni rige la excepción a DR1)
 *   hasta que el familiar vinculado lo confirma (`confirmStayChangeIntentByFamily`). Sin familiar activo, no se crea.
 * - Notifica al estudiante, a su familiar y (solo si quedó `open`) a la residencia actual.
 * - Nunca toca la reserva ni la estadía: no cancela, no libera la plaza.
 */
export async function createStayChangeIntent(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    estimatedExitDate: unknown;
    studentMessage: unknown;
    confirmed: boolean;
  },
  now: Date = new Date(),
): Promise<CreateStayChangeIntentResult> {
  const student = await loadStudentByUserId(admin, params.actorUserId);
  if (!student) return { ok: false, error: "No encontramos tu perfil de estudiante." };

  if (!params.confirmed) {
    return { ok: false, error: "Marcá la confirmación para poder avisar a tu residencia." };
  }
  const input = validateStudentIntentInput(
    { estimatedExitDate: params.estimatedExitDate, studentMessage: params.studentMessage },
    now,
  );
  if (!input.ok) return input;

  // Anti-spam: máximo 1 aviso NUEVO por estudiante cada 24 h (cuenta cualquier aviso, aunque ya esté cerrado).
  const since = new Date(now.getTime() - STAY_CHANGE_CREATE_COOLDOWN_HOURS * 3_600_000).toISOString();
  const { count: recent, error: recentError } = await admin
    .from("stay_change_intents")
    .select("id", { count: "exact", head: true })
    .eq("student_profile_id", student.id)
    .gte("created_at", since);
  if (recentError) {
    console.error("[stayChange] cooldown read failed:", recentError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if ((recent ?? 0) > 0) {
    return { ok: false, error: "Ya avisaste hace poco. Para evitar avisos repetidos, podés volver a avisar pasadas 24 horas desde tu último aviso." };
  }

  const familyUserIds = await loadActiveFamilyUserIds(admin, student.id);
  if (student.is_minor && familyUserIds.length === 0) {
    return { ok: false, error: "Sos menor de edad: necesitás un familiar vinculado para avisar a tu residencia." };
  }

  const eligibility = await loadStayChangeEligibility(admin, student.id, now);
  if (!eligibility.ok) return { ok: false, error: eligibility.error };
  const ctx = eligibility.context;

  const status = student.is_minor ? "pending_guardian_confirmation" : "open";
  const { data: inserted, error } = await admin
    .from("stay_change_intents")
    .insert({
      student_profile_id: student.id,
      resident_stay_id: ctx.residentStayId,
      reservation_id: ctx.reservationId,
      current_residence_id: ctx.currentResidenceId,
      status,
      estimated_exit_date: input.value.estimatedExitDate,
      student_message: input.value.studentMessage,
      expires_at: stayChangeExpiryFrom(now).toISOString(),
      terms_accepted_at: now.toISOString(),
      created_by_minor: student.is_minor,
      // Preaviso: arranca ahora (menores: cuando el familiar confirme). Una reserva nueva no avanza a pago antes de 48 h.
      notice_started_at: student.is_minor ? null : now.toISOString(),
      payment_unlocked_at: student.is_minor ? null : advanceUnlockAt(now).toISOString(),
      created_by_user_id: params.actorUserId,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Ya tenés un aviso de cambio en curso." };
  if (error || !inserted) {
    console.error("[stayChange] insert failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "stay_change_intent_created",
    entityType: "stay_change_intents",
    entityId: inserted.id,
    oldValue: null,
    newValue: {
      status,
      current_residence_id: ctx.currentResidenceId,
      estimated_exit_date: input.value.estimatedExitDate,
    },
  });

  const name = shortStudentName(student);
  const entity = { relatedEntityType: "stay_change_intents", relatedEntityId: inserted.id } as const;
  if (status === "open") {
    await createNotification(admin, {
      userId: params.actorUserId,
      title: "Avisaste que buscás un cambio",
      body: `Le avisamos a ${ctx.currentResidenceName} que buscás un cambio. Ya podés solicitar con fechas que se superponen. Tu reserva sigue igual y la baja de tu estadía la registra tu residencia. ${UNPAID_DISCLAIMER}`,
      ...entity,
    });
    for (const userId of familyUserIds) {
      await createNotification(admin, {
        userId,
        title: `${name} avisó que busca cambiar de residencia`,
        body: `${name} le avisó a su residencia actual que busca otro lugar. Su reserva sigue vigente. Vas a ver la respuesta de la residencia cuando llegue.`,
        ...entity,
      });
    }
    for (const userId of await loadResidenceUserIds(admin, ctx.currentResidenceId)) {
      await createNotification(admin, {
        userId,
        title: `${name} avisó que busca cambiar de residencia`,
        body: `Salida estimada: ${input.value.estimatedExitDate ?? "sin definir"}. Respondele con los costos y condiciones de salida desde Residentes.`,
        ...entity,
      });
    }
  } else {
    await createNotification(admin, {
      userId: params.actorUserId,
      title: "Tu aviso de cambio espera a tu familiar",
      body: "Como sos menor de edad, tu familiar vinculado tiene que confirmar el aviso antes de enviarlo a tu residencia. Tu reserva sigue igual.",
      ...entity,
    });
    for (const userId of familyUserIds) {
      await createNotification(admin, {
        userId,
        title: `${name} quiere avisar que busca cambiar de residencia`,
        body: "Confirmalo para que le avisemos a la residencia actual. No cancela la reserva ni asegura lugar en otra residencia.",
        ...entity,
      });
    }
  }

  return { ok: true, intentId: inserted.id, status };
}

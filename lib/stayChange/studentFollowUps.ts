import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { GENERIC_ERROR, NOT_FOUND_ERROR, loadIntent, loadStudentByUserId } from "@/lib/stayChange/common";
import { loadActiveFamilyUserIds, loadResidenceUserIds, shortStudentName } from "@/lib/stayChange/recipients";
import { advanceUnlockAt } from "@/lib/stayChange/advanceGate";
import { stayChangeExpiryFrom } from "@/lib/stayChange/status";

/**
 * Marca que el estudiante vio la respuesta de la residencia (`response_seen_by_student_at`). Idempotente: solo la
 * primera vez avisa a la residencia ("vio tu respuesta"). Solo el estudiante dueño.
 */
export async function markStayChangeResponseSeen(
  admin: SupabaseClient,
  params: { actorUserId: string; intentId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const student = await loadStudentByUserId(admin, params.actorUserId);
  const intent = await loadIntent(admin, params.intentId);
  if (!student || !intent || intent.student_profile_id !== student.id) return { ok: false, error: NOT_FOUND_ERROR };
  if (!intent.residence_responded_at || intent.response_seen_by_student_at) return { ok: true };

  const { data: updated, error } = await admin
    .from("stay_change_intents")
    .update({ response_seen_by_student_at: new Date().toISOString() })
    .eq("id", intent.id)
    .is("response_seen_by_student_at", null)
    .select("id");
  if (error) {
    console.error("[stayChange] mark seen failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (updated?.length && intent.status === "open") {
    const name = shortStudentName(student);
    for (const userId of await loadResidenceUserIds(admin, intent.current_residence_id)) {
      await createNotification(admin, {
        userId,
        title: `${name} vio tu respuesta sobre su salida`,
        body: "Quedó registrado que leyó los costos y condiciones que informaste.",
        relatedEntityType: "stay_change_intents",
        relatedEntityId: intent.id,
      });
    }
  }
  return { ok: true };
}

/**
 * "Seguir buscando" (recordatorio del día 80): el estudiante confirma y el aviso se extiende 90 días más.
 * Solo avisos `open`. Reinicia el recordatorio para que pueda volver a recibirlo.
 */
export async function confirmStillSearching(
  admin: SupabaseClient,
  params: { actorUserId: string; intentId: string },
  now: Date = new Date(),
): Promise<{ ok: true; expiresAt: string } | { ok: false; error: string }> {
  const student = await loadStudentByUserId(admin, params.actorUserId);
  const intent = await loadIntent(admin, params.intentId);
  if (!student || !intent || intent.student_profile_id !== student.id) return { ok: false, error: NOT_FOUND_ERROR };
  if (intent.status !== "open") return { ok: false, error: "Este aviso ya no está abierto." };

  const expiresAt = stayChangeExpiryFrom(now).toISOString();
  const { data: updated, error } = await admin
    .from("stay_change_intents")
    .update({ expires_at: expiresAt, last_keep_alive_notified_at: null })
    .eq("id", intent.id)
    .eq("status", "open")
    .select("id");
  if (error || !updated?.length) {
    if (error) console.error("[stayChange] keep alive failed:", error);
    return { ok: false, error: error ? GENERIC_ERROR : "Este aviso ya no está abierto." };
  }
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "stay_change_intent_extended",
    entityType: "stay_change_intents",
    entityId: intent.id,
    oldValue: { expires_at: intent.expires_at },
    newValue: { expires_at: expiresAt },
  });
  return { ok: true, expiresAt };
}

/**
 * Menores: el familiar vinculado ACTIVO confirma el aviso que inició el menor. Recién ahí pasa a `open`, rige la
 * excepción a DR1 y se le avisa a la residencia actual. El familiar no crea ni edita avisos, y no ve el mensaje
 * privado del estudiante (decisión del dueño).
 */
export async function confirmStayChangeIntentByFamily(
  admin: SupabaseClient,
  params: { actorUserId: string; intentId: string },
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const intent = await loadIntent(admin, params.intentId);
  if (!intent) return { ok: false, error: NOT_FOUND_ERROR };
  const familyUserIds = await loadActiveFamilyUserIds(admin, intent.student_profile_id);
  if (!familyUserIds.includes(params.actorUserId)) return { ok: false, error: NOT_FOUND_ERROR };
  if (intent.status !== "pending_guardian_confirmation") {
    return { ok: false, error: "Este aviso ya no está esperando tu confirmación." };
  }

  const { data: updated, error } = await admin
    .from("stay_change_intents")
    .update({
      status: "open",
      guardian_confirmed_at: now.toISOString(),
      guardian_confirmed_by_user_id: params.actorUserId,
      expires_at: stayChangeExpiryFrom(now).toISOString(),
      // El preaviso de los menores corre desde la confirmación del familiar.
      notice_started_at: now.toISOString(),
      payment_unlocked_at: advanceUnlockAt(now).toISOString(),
    })
    .eq("id", intent.id)
    .eq("status", "pending_guardian_confirmation")
    .select("id");
  if (error) {
    console.error("[stayChange] family confirm failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!updated?.length) return { ok: false, error: "Este aviso ya no está esperando tu confirmación." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "family_member",
    action: "stay_change_intent_confirmed_by_family",
    entityType: "stay_change_intents",
    entityId: intent.id,
    oldValue: { status: "pending_guardian_confirmation" },
    newValue: { status: "open" },
  });

  const { data: student } = await admin
    .from("student_profiles")
    .select("user_id, first_name, last_initial")
    .eq("id", intent.student_profile_id)
    .maybeSingle();
  const name = shortStudentName(student as { first_name: string | null; last_initial: string | null } | null);
  const entity = { relatedEntityType: "stay_change_intents", relatedEntityId: intent.id } as const;
  if (student?.user_id) {
    await createNotification(admin, {
      userId: student.user_id as string,
      title: "Tu familiar confirmó tu aviso de cambio",
      body: "Le avisamos a tu residencia actual. Ya podés solicitar con fechas que se superponen. Tu reserva sigue igual.",
      ...entity,
    });
  }
  for (const userId of await loadResidenceUserIds(admin, intent.current_residence_id)) {
    await createNotification(admin, {
      userId,
      title: `${name} avisó que busca cambiar de residencia`,
      body: `Salida estimada: ${intent.estimated_exit_date ?? "sin definir"}. Respondele con los costos y condiciones de salida desde Residentes.`,
      ...entity,
    });
  }
  return { ok: true };
}

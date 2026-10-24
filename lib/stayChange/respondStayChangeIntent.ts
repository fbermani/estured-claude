import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { GENERIC_ERROR, NOT_FOUND_ERROR, loadIntent } from "@/lib/stayChange/common";
import { loadActiveFamilyUserIds } from "@/lib/stayChange/recipients";
import { UNPAID_DISCLAIMER } from "@/lib/stayChange/copy";
import { validateResidenceResponse } from "@/lib/stayChange/validate";

export type RespondStayChangeIntentResult = { ok: true; edited: boolean } | { ok: false; error: string };

/**
 * La residencia ACTUAL responde (o edita su respuesta) mientras el aviso esté `open`: mensaje obligatorio, costos de
 * salida (texto + monto de referencia opcional en USD), condiciones y detalles. Es INFORMATIVA: EstuRed no fija,
 * cobra, garantiza ni media esos costos. Cada versión queda auditada (valor anterior y nuevo). Notifica al estudiante
 * y a su familiar; una edición reinicia `response_seen_by_student_at` para que el estudiante vea el "nuevo".
 * Autorización: owner/staff ACTIVO de `current_residence_id` (aislamiento multi-residencia, docs/11 §7.3).
 */
export async function respondStayChangeIntent(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    intentId: string;
    message: unknown;
    exitCostsText: unknown;
    exitCostsUsd: unknown;
    exitConditionsText: unknown;
    exitDetailsText: unknown;
  },
): Promise<RespondStayChangeIntentResult> {
  const intent = await loadIntent(admin, params.intentId);
  if (!intent) return { ok: false, error: NOT_FOUND_ERROR };

  const { data: membership, error: membershipError } = await admin
    .from("residence_users")
    .select("role")
    .eq("residence_id", intent.current_residence_id)
    .eq("user_id", params.actorUserId)
    .eq("is_active", true)
    .maybeSingle();
  if (membershipError) {
    console.error("[stayChange] respond membership read failed:", membershipError);
    return { ok: false, error: GENERIC_ERROR };
  }
  // Mismo mensaje que "no existe": no revelar avisos de otras residencias.
  if (!membership || intent.status === "pending_guardian_confirmation") return { ok: false, error: NOT_FOUND_ERROR };
  if (intent.status !== "open") {
    return { ok: false, error: "Este aviso ya está cerrado: no se puede responder." };
  }

  const input = validateResidenceResponse({
    message: params.message,
    exitCostsText: params.exitCostsText,
    exitCostsUsd: params.exitCostsUsd,
    exitConditionsText: params.exitConditionsText,
    exitDetailsText: params.exitDetailsText,
  });
  if (!input.ok) return input;
  const v = input.value;

  const edited = intent.residence_responded_at !== null;
  const { data: updated, error } = await admin
    .from("stay_change_intents")
    .update({
      residence_response_message: v.message,
      residence_exit_costs_text: v.exitCostsText,
      residence_exit_costs_usd: v.exitCostsUsd,
      residence_exit_conditions_text: v.exitConditionsText,
      residence_exit_details_text: v.exitDetailsText,
      residence_responded_at: new Date().toISOString(),
      residence_responded_by_user_id: params.actorUserId,
      residence_response_edit_count: edited ? intent.residence_response_edit_count + 1 : 0,
      response_seen_by_student_at: null,
    })
    .eq("id", intent.id)
    .eq("status", "open")
    .select("id");
  if (error) {
    console.error("[stayChange] respond failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!updated?.length) return { ok: false, error: "Este aviso ya está cerrado: no se puede responder." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: membership.role === "owner" ? "residence_owner" : "residence_staff",
    action: edited ? "stay_change_response_edited" : "stay_change_response_sent",
    entityType: "stay_change_intents",
    entityId: intent.id,
    oldValue: edited
      ? {
          message: intent.residence_response_message,
          exit_costs_text: intent.residence_exit_costs_text,
          exit_costs_usd: intent.residence_exit_costs_usd,
          exit_conditions_text: intent.residence_exit_conditions_text,
          exit_details_text: intent.residence_exit_details_text,
        }
      : null,
    newValue: {
      message: v.message,
      exit_costs_text: v.exitCostsText,
      exit_costs_usd: v.exitCostsUsd,
      exit_conditions_text: v.exitConditionsText,
      exit_details_text: v.exitDetailsText,
    },
  });

  const [{ data: residence }, { data: student }] = await Promise.all([
    admin.from("residences").select("name").eq("id", intent.current_residence_id).maybeSingle(),
    admin.from("student_profiles").select("user_id, first_name").eq("id", intent.student_profile_id).maybeSingle(),
  ]);
  const residenceName = residence?.name ?? "Tu residencia";
  const entity = { relatedEntityType: "stay_change_intents", relatedEntityId: intent.id } as const;
  if (student?.user_id) {
    await createNotification(admin, {
      userId: student.user_id as string,
      title: edited ? `${residenceName} actualizó su respuesta` : `${residenceName} respondió a tu aviso`,
      body: `Te informó costos y condiciones de salida. Es información de tu residencia: no modifica tu contrato. Ante dudas, escribí a Soporte. ${UNPAID_DISCLAIMER}`,
      ...entity,
    });
  }
  const studentName = (student?.first_name as string | undefined) ?? "tu familiar";
  for (const userId of await loadActiveFamilyUserIds(admin, intent.student_profile_id)) {
    await createNotification(admin, {
      userId,
      title: `La residencia de ${studentName} informó costos y condiciones de salida`,
      body: "Podés ver el detalle en solo lectura. La decisión es de tu familiar.",
      ...entity,
    });
  }
  return { ok: true, edited };
}

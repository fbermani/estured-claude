import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { loadResidenceUserIds } from "@/lib/stayChange/recipients";

export type FollowupAdminResult = { ok: true } | { ok: false; error: string };
type Actor = { actorUserId: string; actorRole: "admin" | "superadmin" };

/** Texto sugerido para «Comunicar a la residencia»: neutro, SIN la respuesta del estudiante. El admin lo edita. */
export const DEFAULT_COMMUNICATION_TEXT =
  "Desde Soporte de EstuRed queremos acompañar a la residencia en el inicio de esta estadía. Te pedimos que converses con la persona residente para ver cómo viene todo.";

/** Admin/superadmin marca como revisada una respuesta (`answered → reviewed`), con nota interna que la residencia nunca ve. */
export async function markFollowupReviewed(
  admin: SupabaseClient,
  params: Actor & { followupId: string; note: string },
): Promise<FollowupAdminResult> {
  const note = params.note.trim();
  if (note.length > 2000) return { ok: false, error: "La nota puede tener hasta 2000 caracteres." };
  const { data: updated, error } = await admin
    .from("stay_followups")
    .update({
      status: "reviewed",
      reviewed_by_user_id: params.actorUserId,
      reviewed_at: new Date().toISOString(),
      admin_note: note || null,
    })
    .eq("id", params.followupId)
    .eq("status", "answered")
    .select("id");
  if (error) {
    console.error("[followups] mark reviewed failed:", error);
    return { ok: false, error: "No pudimos guardar la revisión. Probá de nuevo." };
  }
  if (!updated?.length) return { ok: false, error: "Solo se puede revisar un seguimiento que ya fue respondido." };
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "stay_followup_reviewed",
    entityType: "stay_followup",
    entityId: params.followupId,
    oldValue: { status: "answered" },
    newValue: { status: "reviewed", has_note: !!note },
    source: "admin",
  });
  return { ok: true };
}

/**
 * Acción admin opcional: comunica algo a la residencia, por Soporte, con el texto que el admin escribió (la respuesta literal solo va
 * si el admin la pega). Crea una notificación a quienes tienen `residents.manage`, marca `communicated_to_residence` y audita solo el largo del texto (no el contenido).
 * Requiere que haya respuesta (`answered` o `reviewed`).
 */
export async function communicateFollowupToResidence(
  admin: SupabaseClient,
  params: Actor & { followupId: string; text: string; resend?: boolean },
): Promise<FollowupAdminResult> {
  const text = params.text.trim();
  if (text.length < 10) return { ok: false, error: "Escribí el mensaje que querés enviar a la residencia." };
  if (text.length > 1000) return { ok: false, error: "El mensaje puede tener hasta 1000 caracteres." };

  const { data: followup } = await admin
    .from("stay_followups")
    .select("id, status, residence_id, resident_stay_id, communicated_to_residence")
    .eq("id", params.followupId)
    .maybeSingle();
  if (!followup) return { ok: false, error: "No encontramos este seguimiento." };
  if (followup.status !== "answered" && followup.status !== "reviewed") {
    return { ok: false, error: "Solo se puede comunicar algo a la residencia cuando ya hay una respuesta." };
  }
  // Guarda contra el doble clic: si ya se comunicó, solo se reenvía con una acción explícita (`resend`).
  if (followup.communicated_to_residence === true && !params.resend) {
    return { ok: false, error: "Ya le comunicaste algo a la residencia por este seguimiento. Si querés enviar otro mensaje, confirmalo." };
  }
  const recipients = await loadResidenceUserIds(admin, followup.residence_id as string);
  if (!recipients.length) return { ok: false, error: "La residencia no tiene a nadie para recibir el mensaje." };

  for (const userId of recipients) {
    await createNotification(admin, {
      userId,
      title: "Mensaje de Soporte de EstuRed",
      body: text,
      relatedEntityType: "resident_stays",
      relatedEntityId: followup.resident_stay_id as string,
    });
  }
  const { error } = await admin.from("stay_followups").update({ communicated_to_residence: true }).eq("id", params.followupId);
  if (error) console.error("[followups] mark communicated failed:", error);
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "stay_followup_communicated_to_residence",
    entityType: "stay_followup",
    entityId: params.followupId,
    newValue: { text_length: text.length, recipients: recipients.length, resend: params.resend === true },
    source: "admin",
  });
  return { ok: true };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { resolveFollowupRole } from "@/lib/followups/access";
import { validateFollowupAnswers } from "@/lib/followups/common";

export type SubmitFollowupResult = { ok: true } | { ok: false; error: string };

/**
 * El estudiante (o su guardián, si es menor) responde la encuesta. Mutación solo server-side: valida el rol, el estado y las opciones.
 * Una respuesta por rol (unique); la primera pasa el seguimiento `sent → answered`. Cada una se audita SIN el contenido
 * (el contenido es dato interno que solo ven admin/superadmin).
 */
export async function submitFollowupResponse(
  admin: SupabaseClient,
  params: { userId: string; followupId: string; howIsItGoing: string; wasAsExpected: string; comment: string },
): Promise<SubmitFollowupResult> {
  const checked = validateFollowupAnswers(params);
  if (!checked.ok) return checked;

  const { data: followup, error } = await admin
    .from("stay_followups")
    .select("id, status, student_profile_id")
    .eq("id", params.followupId)
    .maybeSingle();
  if (error || !followup) return { ok: false, error: "No encontramos esta encuesta." };
  const role = await resolveFollowupRole(admin, params.userId, followup as { student_profile_id: string | null });
  if (!role) return { ok: false, error: "No encontramos esta encuesta." };
  if (followup.status !== "sent" && followup.status !== "answered") {
    return { ok: false, error: "Esta encuesta ya no está disponible. Si necesitás ayuda con algo, escribile a Soporte." };
  }

  const { data: already } = await admin
    .from("stay_followup_responses")
    .select("id")
    .eq("stay_followup_id", params.followupId)
    .eq("respondent_role", role)
    .maybeSingle();
  if (already) return { ok: false, error: "Ya respondiste esta encuesta. ¡Gracias!" };

  const { error: insertError } = await admin.from("stay_followup_responses").insert({
    stay_followup_id: params.followupId,
    respondent_user_id: params.userId,
    respondent_role: role,
    how_is_it_going: params.howIsItGoing,
    was_as_expected: params.wasAsExpected,
    comment: checked.comment,
  });
  if (insertError) {
    if (insertError.code === "23505") return { ok: false, error: "Ya respondiste esta encuesta. ¡Gracias!" };
    console.error("[followups] insert response failed:", insertError);
    return { ok: false, error: "No pudimos guardar tu respuesta. Probá de nuevo en unos minutos." };
  }

  if (followup.status === "sent") {
    await admin.from("stay_followups").update({ status: "answered" }).eq("id", params.followupId).eq("status", "sent");
  }
  await createAuditLog(admin, {
    actorUserId: params.userId,
    actorRole: role === "guardian" ? "family_member" : "student",
    action: "stay_followup_answered",
    entityType: "stay_followup",
    entityId: params.followupId,
    oldValue: { status: followup.status },
    newValue: { status: "answered", respondent_role: role },
    source: "user",
  });
  return { ok: true };
}

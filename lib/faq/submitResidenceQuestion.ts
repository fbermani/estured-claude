import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import {
  ANONYMOUS_QUESTIONS_PER_HOUR,
  MAX_PENDING_PER_RESIDENCE,
  QUESTIONS_PER_HOUR,
  excerpt,
  validateQuestion,
} from "@/lib/faq/validateFaq";

export type SubmitResidenceQuestionResult = { ok: true; questionId: string } | { ok: false; error: string };

/**
 * Pregunta libre del visitante a una residencia (D9 / H12). Sin PII
 * obligatoria: si hay sesión se guarda `asked_by_user_id` (para avisar en la
 * app cuando respondan); la IP solo se guarda hasheada, para el límite por hora.
 * No hay respuesta automática: la pregunta queda `pending` y le llega a la
 * residencia como notificación.
 *
 * Extraída del server action (patrón del proyecto): recibe el `ipHash` ya
 * calculado, no resuelve el request.
 */
export async function submitResidenceQuestion(
  admin: SupabaseClient,
  params: { residenceId: string; question: unknown; userId: string | null; ipHash: string | null },
): Promise<SubmitResidenceQuestionResult> {
  const checked = validateQuestion(params.question);
  if (!checked.ok) return checked;

  // Solo residencias publicadas reciben preguntas (las mismas que muestra la ficha pública).
  const { data: residence } = await admin
    .from("residences")
    .select("id, name")
    .eq("id", params.residenceId)
    .eq("status", "verified_active")
    .maybeSingle();
  if (!residence) {
    return { ok: false, error: "No encontramos esa residencia. Recargá la página e intentá de nuevo." };
  }

  // Tope de pendientes por residencia: evita inundar la bandeja de quien responde.
  const { count: pendingCount } = await admin
    .from("residence_faq_questions")
    .select("id", { count: "exact", head: true })
    .eq("residence_id", residence.id)
    .eq("status", "pending");
  if ((pendingCount ?? 0) >= MAX_PENDING_PER_RESIDENCE) {
    return {
      ok: false,
      error: "Esta residencia tiene muchas preguntas sin responder en este momento. Probá de nuevo más adelante.",
    };
  }

  // Límite por hora: por IP (hash) y por usuario con sesión; sin ninguno de los dos, un tope global.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = () =>
    admin
      .from("residence_faq_questions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneHourAgo);
  const limits: PromiseLike<{ count: number | null }>[] = [];
  const caps: number[] = [];
  if (params.ipHash) {
    limits.push(recent().eq("ip_hash", params.ipHash));
    caps.push(QUESTIONS_PER_HOUR);
  }
  if (params.userId) {
    limits.push(recent().eq("asked_by_user_id", params.userId));
    caps.push(QUESTIONS_PER_HOUR);
  }
  if (!params.ipHash && !params.userId) {
    limits.push(recent().is("ip_hash", null).is("asked_by_user_id", null));
    caps.push(ANONYMOUS_QUESTIONS_PER_HOUR);
  }
  const counts = await Promise.all(limits);
  if (counts.some((c, i) => (c.count ?? 0) >= caps[i])) {
    return { ok: false, error: "Recibimos muchas preguntas en la última hora. Probá de nuevo más tarde." };
  }

  const { data: inserted, error } = await admin
    .from("residence_faq_questions")
    .insert({
      residence_id: residence.id,
      question: checked.value,
      asked_by_user_id: params.userId,
      ip_hash: params.ipHash,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[faq] insert failed:", error?.code, error?.message);
    return { ok: false, error: "No pudimos guardar tu pregunta. Intentá de nuevo en unos minutos." };
  }

  // Aviso in-app a quienes gestionan la residencia (owner y staff activos). Nunca rompe el envío.
  const { data: members } = await admin
    .from("residence_users")
    .select("user_id")
    .eq("residence_id", residence.id)
    .eq("is_active", true);
  await Promise.all(
    (members ?? []).map((m) =>
      createNotification(admin, {
        userId: m.user_id as string,
        title: "Nueva pregunta en tu ficha",
        body: `Un visitante preguntó: «${excerpt(checked.value)}». Respondela desde Preguntas.`,
        relatedEntityType: "residence_faq_questions",
        relatedEntityId: inserted.id as string,
      }),
    ),
  );

  return { ok: true, questionId: inserted.id as string };
}

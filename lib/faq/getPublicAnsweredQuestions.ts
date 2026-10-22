import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicFaqQuestion = { question: string; answer: string };

const PUBLIC_LIMIT = 10;

/**
 * Preguntas libres ya respondidas de una residencia, para la ficha pública.
 * La tabla no tiene policies: se lee con service role y se devuelve SOLO
 * pregunta + respuesta de las `answered` (nada de autor, IP ni ids). Si la
 * consulta falla, la ficha sigue andando sin esa sección.
 */
export async function getPublicAnsweredQuestions(
  admin: SupabaseClient,
  residenceId: string,
): Promise<PublicFaqQuestion[]> {
  const { data, error } = await admin
    .from("residence_faq_questions")
    .select("question, answer")
    .eq("residence_id", residenceId)
    .eq("status", "answered")
    .order("answered_at", { ascending: false })
    .limit(PUBLIC_LIMIT);
  if (error) {
    console.error("[faq] public read failed:", error.code, error.message);
    return [];
  }
  return (data ?? []).flatMap((row) =>
    row.question && row.answer ? [{ question: row.question as string, answer: row.answer as string }] : [],
  );
}

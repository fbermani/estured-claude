import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

/** `isFeatured` / `featuredOrder`: lo que la residencia destacó (migración 0096); ausentes si la migración no está aplicada. */
export type PublicFaqQuestion = { question: string; answer: string; isFeatured?: boolean; featuredOrder?: number | null };

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
  // Con las columnas de destacadas (0096); si todavía no existen, se reintenta sin ellas.
  let withFeatured = true;
  let data: unknown[] | null = null;
  let error: { code?: string | null; message?: string | null } | null = null;
  for (const cols of ["question, answer, is_featured, featured_order", "question, answer"]) {
    withFeatured = cols.includes("is_featured");
    ({ data, error } = await admin
      .from("residence_faq_questions")
      .select(cols)
      .eq("residence_id", residenceId)
      .eq("status", "answered")
      .order("answered_at", { ascending: false })
      .limit(PUBLIC_LIMIT));
    if (!error || !isMissingSchemaError(error)) break;
  }
  if (error) {
    console.error("[faq] public read failed:", error.code, error.message);
    return [];
  }
  return ((data ?? []) as { question: string | null; answer: string | null; is_featured?: boolean; featured_order?: number | null }[]).flatMap((row) =>
    row.question && row.answer
      ? [{ question: row.question, answer: row.answer, ...(withFeatured ? { isFeatured: row.is_featured === true, featuredOrder: row.featured_order ?? null } : {}) }]
      : [],
  );
}

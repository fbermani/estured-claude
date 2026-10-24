import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Contadores del menú de la residencia (Ciclo 63): solicitudes nuevas sin revisar (`submitted`) y preguntas
 * públicas sin responder (`pending`). Ante un error de lectura devuelven 0 (loggeado): un contador nunca tumba la página.
 */
export async function countNewApplications(admin: SupabaseClient, residenceId: string): Promise<number> {
  const { count, error } = await admin
    .from("application_requests")
    .select("id", { count: "exact", head: true })
    .eq("residence_id", residenceId)
    .eq("status", "submitted");
  if (error) console.error("[residence] no se pudo contar solicitudes nuevas:", error);
  return count ?? 0;
}

export async function countPendingQuestions(admin: SupabaseClient, residenceId: string): Promise<number> {
  const { count, error } = await admin
    .from("residence_faq_questions")
    .select("id", { count: "exact", head: true })
    .eq("residence_id", residenceId)
    .eq("status", "pending");
  if (error) console.error("[residence] no se pudo contar preguntas sin responder:", error);
  return count ?? 0;
}

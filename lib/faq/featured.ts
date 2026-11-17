import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { effectiveAnswer, hasUnfilledFields, isEditableOwner, type CatalogQuestion } from "@/lib/faq/catalog";
import { parseFeaturedRefs, type FeaturedRef } from "@/lib/faq/featuredSelection";

export const FEATURED_MIGRATION_PENDING_MESSAGE =
  "Elegir preguntas destacadas todavía no está disponible en este entorno. Mientras tanto, la ficha destaca las primeras 6.";

export type FeaturedCandidate = {
  ref: FeaturedRef;
  /** Texto de la pregunta, tal como la ve el visitante. */
  question: string;
  /** Orden elegido (1 a 6) si hoy está destacada, `null` si no. */
  order: number | null;
};

export type FeaturedLoad =
  | { ok: true; candidates: FeaturedCandidate[] }
  | { ok: false; reason: "schema_pending" | "failed" };

/**
 * Preguntas que HOY se muestran en la ficha y por lo tanto se pueden destacar: las del catálogo seleccionadas y completas (sin campos `{…}`
 * pendientes, igual que la ficha pública) y las libres ya respondidas. Cada una con su orden si está destacada. Lectura con service role.
 */
export async function loadFeaturedCandidates(admin: SupabaseClient, residenceId: string): Promise<FeaturedLoad> {
  const itemsRes = await admin
    .from("residence_faq_items")
    .select("predefined_question_id, answer_override, is_featured, featured_order")
    .eq("residence_id", residenceId)
    .eq("is_selected", true);
  if (itemsRes.error) {
    if (isMissingSchemaError(itemsRes.error)) return { ok: false, reason: "schema_pending" };
    console.error("[faq-featured] items:", itemsRes.error.code, itemsRes.error.message);
    return { ok: false, reason: "failed" };
  }
  const freeRes = await admin
    .from("residence_faq_questions")
    .select("id, question, is_featured, featured_order, answered_at")
    .eq("residence_id", residenceId)
    .eq("status", "answered")
    .order("answered_at", { ascending: false })
    .limit(50);
  if (freeRes.error) {
    if (isMissingSchemaError(freeRes.error)) return { ok: false, reason: "schema_pending" };
    console.error("[faq-featured] free:", freeRes.error.code, freeRes.error.message);
    return { ok: false, reason: "failed" };
  }

  const selected = (itemsRes.data ?? []) as { predefined_question_id: string; answer_override: string | null; is_featured: boolean; featured_order: number | null }[];
  const candidates: FeaturedCandidate[] = [];
  if (selected.length > 0) {
    const { data: questions, error } = await admin
      .from("residence_faq_predefined_questions")
      .select("id, category, question_text, suggested_answer, owner, display_order")
      .eq("is_active", true)
      .in("id", selected.map((s) => s.predefined_question_id))
      .order("display_order", { ascending: true });
    if (error) {
      console.error("[faq-featured] catálogo:", error.code, error.message);
      return { ok: false, reason: "failed" };
    }
    const byId = new Map(selected.map((s) => [s.predefined_question_id, s]));
    for (const q of (questions ?? []) as CatalogQuestion[]) {
      const sel = byId.get(q.id);
      const answer = effectiveAnswer(q, { is_selected: true, answer_override: isEditableOwner(q.owner) ? (sel?.answer_override ?? null) : null });
      if (hasUnfilledFields(answer)) continue; // no se muestra en la ficha: no se puede destacar
      candidates.push({ ref: { kind: "catalog", id: q.id }, question: q.question_text, order: sel?.is_featured ? (sel.featured_order ?? null) : null });
    }
  }
  for (const f of (freeRes.data ?? []) as { id: string; question: string; is_featured: boolean; featured_order: number | null }[]) {
    candidates.push({ ref: { kind: "free", id: f.id }, question: f.question, order: f.is_featured ? (f.featured_order ?? null) : null });
  }
  return { ok: true, candidates };
}

export type SaveFeaturedResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Guarda cuáles preguntas se destacan y en qué orden (permiso `faq.manage`). Reemplaza TODA la selección anterior de la residencia:
 * valida la lista (hasta 6, sin repetidos), que cada pregunta pertenezca a ESTA residencia y hoy se muestre (catálogo seleccionado /
 * libre respondida), apaga las destacadas actuales y marca las nuevas con su posición. El tope también lo garantiza un trigger en la base
 * (0096). Auditado. Una lista vacía vuelve al comportamiento por defecto (la ficha destaca las primeras 6).
 */
export async function saveFeaturedFaq(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; refs: unknown },
): Promise<SaveFeaturedResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "faq.manage");
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = parseFeaturedRefs(params.refs);
  if (!parsed.ok) return parsed;
  const { refs } = parsed;

  // Cada pregunta tiene que ser de ESTA residencia y mostrarse hoy (nunca se confía en los ids del cliente).
  const load = await loadFeaturedCandidates(admin, params.residenceId);
  if (!load.ok) {
    return { ok: false, error: load.reason === "schema_pending" ? FEATURED_MIGRATION_PENDING_MESSAGE : "No pudimos guardar tu selección. Intentá de nuevo." };
  }
  const allowed = new Set(load.candidates.map((c) => `${c.ref.kind}:${c.ref.id}`));
  if (refs.some((r) => !allowed.has(`${r.kind}:${r.id}`))) {
    return { ok: false, error: "Alguna de las preguntas ya no se muestra en tu ficha. Recargá la página y volvé a elegir." };
  }

  const before = load.candidates.filter((c) => c.order != null).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => c.ref);

  // 1) Se apagan todas las destacadas de la residencia (también las que ya no se muestran) y 2) se marcan las nuevas.
  const clear = { is_featured: false, featured_order: null };
  for (const table of ["residence_faq_items", "residence_faq_questions"] as const) {
    const { error } = await admin.from(table).update(clear).eq("residence_id", params.residenceId).eq("is_featured", true);
    if (error) {
      if (isMissingSchemaError(error)) return { ok: false, error: FEATURED_MIGRATION_PENDING_MESSAGE };
      console.error("[faq-featured] apagar:", table, error.code, error.message);
      return { ok: false, error: "No pudimos guardar tu selección. Intentá de nuevo." };
    }
  }
  for (const [index, ref] of refs.entries()) {
    const query =
      ref.kind === "catalog"
        ? admin.from("residence_faq_items").update({ is_featured: true, featured_order: index + 1 }).eq("residence_id", params.residenceId).eq("predefined_question_id", ref.id)
        : admin.from("residence_faq_questions").update({ is_featured: true, featured_order: index + 1 }).eq("residence_id", params.residenceId).eq("id", ref.id);
    const { error } = await query;
    if (error) {
      console.error("[faq-featured] marcar:", ref.kind, error.code, error.message);
      return { ok: false, error: "No pudimos guardar toda tu selección. Probá de nuevo: lo que ya estaba elegido puede haber quedado a medias." };
    }
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "residence_faq_featured_updated",
    entityType: "residences",
    entityId: params.residenceId,
    oldValue: { featured: before },
    newValue: { featured: refs },
  });
  return { ok: true, count: refs.length };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import {
  FAQ_CATEGORIES,
  checkCatalogSave,
  effectiveAnswer,
  hasUnfilledFields,
  isEditableOwner,
  type CatalogQuestion,
  type CatalogSelection,
} from "@/lib/faq/catalog";

export const CATALOG_MIGRATION_PENDING_MESSAGE =
  "El catálogo de preguntas frecuentes todavía no está disponible en este entorno. Probá de nuevo más adelante.";

const CATALOG_COLUMNS = "id, category, question_text, suggested_answer, owner, display_order";

export type CatalogEntry = CatalogQuestion & { selection: CatalogSelection | null };
export type CatalogLoad =
  | { ok: true; entries: CatalogEntry[] }
  | { ok: false; reason: "schema_pending" | "failed" };

/** Catálogo activo + lo que esta residencia eligió (para su pantalla; service role). */
export async function loadCatalogForResidence(admin: SupabaseClient, residenceId: string): Promise<CatalogLoad> {
  const { data: questions, error } = await admin
    .from("residence_faq_predefined_questions")
    .select(CATALOG_COLUMNS)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, reason: "schema_pending" };
    console.error("[faq] catalog read failed:", error.code, error.message);
    return { ok: false, reason: "failed" };
  }
  const { data: items, error: itemsError } = await admin
    .from("residence_faq_items")
    .select("predefined_question_id, is_selected, answer_override")
    .eq("residence_id", residenceId);
  if (itemsError) {
    if (isMissingSchemaError(itemsError)) return { ok: false, reason: "schema_pending" };
    console.error("[faq] items read failed:", itemsError.code, itemsError.message);
    return { ok: false, reason: "failed" };
  }
  const byQuestion = new Map(
    (items ?? []).map((i) => [
      i.predefined_question_id as string,
      { is_selected: Boolean(i.is_selected), answer_override: (i.answer_override as string | null) ?? null },
    ]),
  );
  const entries = ((questions ?? []) as CatalogQuestion[]).map((q) => ({ ...q, selection: byQuestion.get(q.id) ?? null }));
  return { ok: true, entries };
}

export type SaveCatalogItemResult = { ok: true; selected: boolean } | { ok: false; error: string };

/**
 * Elegir mostrar / ocultar una pregunta del catálogo y editar su respuesta (DR14). Permiso `faq.manage` (el dueño siempre; el staff si
 * el dueño se lo encendió). Las «EstuRed fija» no se editan. Para MOSTRAR una pregunta con campos `{…}` hay que completarlos. Auditado.
 */
export async function saveCatalogItem(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; questionId: string; selected: boolean; answer: unknown },
): Promise<SaveCatalogItemResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "faq.manage");
  if (!access.ok) return { ok: false, error: access.error };

  const { data: question, error: questionError } = await admin
    .from("residence_faq_predefined_questions")
    .select(CATALOG_COLUMNS)
    .eq("id", params.questionId)
    .eq("is_active", true)
    .maybeSingle();
  if (questionError) {
    if (isMissingSchemaError(questionError)) return { ok: false, error: CATALOG_MIGRATION_PENDING_MESSAGE };
    console.error("[faq] catalog load failed:", questionError.code, questionError.message);
    return { ok: false, error: "No pudimos cargar la pregunta. Intentá de nuevo." };
  }
  if (!question) return { ok: false, error: "Esa pregunta ya no está en el catálogo. Recargá la página." };

  const checked = checkCatalogSave(question as CatalogQuestion, { selected: params.selected, answer: params.answer });
  if (!checked.ok) return checked;

  const { data: previous, error: previousError } = await admin
    .from("residence_faq_items")
    .select("is_selected, answer_override")
    .eq("residence_id", params.residenceId)
    .eq("predefined_question_id", params.questionId)
    .maybeSingle();
  if (previousError) {
    if (isMissingSchemaError(previousError)) return { ok: false, error: CATALOG_MIGRATION_PENDING_MESSAGE };
    console.error("[faq] item load failed:", previousError.code, previousError.message);
    return { ok: false, error: "No pudimos guardar el cambio. Intentá de nuevo." };
  }

  const { data: saved, error } = await admin
    .from("residence_faq_items")
    .upsert(
      {
        residence_id: params.residenceId,
        predefined_question_id: params.questionId,
        is_selected: params.selected,
        answer_override: checked.override,
      },
      { onConflict: "residence_id,predefined_question_id" },
    )
    .select("id")
    .single();
  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, error: CATALOG_MIGRATION_PENDING_MESSAGE };
    console.error("[faq] item save failed:", error.code, error.message);
    return { ok: false, error: "No pudimos guardar el cambio. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "residence_faq_catalog_item_saved",
    entityType: "residence_faq_items",
    entityId: (saved?.id as string | undefined) ?? null,
    oldValue: previous ? { is_selected: previous.is_selected, answer_override: previous.answer_override } : null,
    newValue: { residence_id: params.residenceId, faq_id: params.questionId, is_selected: params.selected, answer_override: checked.override },
  });
  return { ok: true, selected: params.selected };
}

/** `isFeatured` / `featuredOrder`: lo que la residencia destacó (migración 0096); ausentes si la migración no está aplicada. */
export type PublicCatalogItem = { question: string; answer: string; isFeatured?: boolean; featuredOrder?: number | null };
export type PublicCatalogGroup = { category: string; label: string; items: PublicCatalogItem[] };

/**
 * Preguntas del catálogo que la residencia eligió mostrar, agrupadas por tema, para la ficha pública. Lee con service role pero NO
 * confía en que la fila esté completa: nunca devuelve una respuesta con campos `{…}` sin completar ni una pregunta que se desactivó
 * del catálogo. Si falla (o la 0054 no está aplicada), devuelve `[]` y la ficha sigue sin esa parte.
 */
export async function getPublicCatalogFaq(admin: SupabaseClient, residenceId: string): Promise<PublicCatalogGroup[]> {
  // Con las columnas de destacadas (0096); si todavía no existen, se reintenta sin ellas (la ficha destaca las primeras).
  let items: unknown[] | null = null;
  let error: { code?: string | null; message?: string | null } | null = null;
  for (const cols of ["predefined_question_id, answer_override, is_featured, featured_order", "predefined_question_id, answer_override"]) {
    ({ data: items, error } = await admin.from("residence_faq_items").select(cols).eq("residence_id", residenceId).eq("is_selected", true));
    if (!error || !isMissingSchemaError(error)) break;
  }
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[faq] public catalog items failed:", error.code, error.message);
    return [];
  }
  const selected = (items ?? []) as { predefined_question_id: string; answer_override: string | null; is_featured?: boolean; featured_order?: number | null }[];
  if (selected.length === 0) return [];

  const { data: questions, error: questionsError } = await admin
    .from("residence_faq_predefined_questions")
    .select(CATALOG_COLUMNS)
    .eq("is_active", true)
    .in(
      "id",
      selected.map((s) => s.predefined_question_id),
    )
    .order("display_order", { ascending: true });
  if (questionsError) {
    if (!isMissingSchemaError(questionsError)) console.error("[faq] public catalog read failed:", questionsError.code, questionsError.message);
    return [];
  }
  const overrides = new Map(selected.map((s) => [s.predefined_question_id, s.answer_override]));
  const featuredBy = new Map(selected.map((s) => [s.predefined_question_id, s]));
  const groups: PublicCatalogGroup[] = FAQ_CATEGORIES.map((c) => ({ category: c.key as string, label: c.label, items: [] }));
  for (const q of (questions ?? []) as CatalogQuestion[]) {
    const answer = effectiveAnswer(q, { is_selected: true, answer_override: isEditableOwner(q.owner) ? (overrides.get(q.id) ?? null) : null });
    if (hasUnfilledFields(answer)) continue;
    const group = groups.find((g) => g.category === q.category);
    const featured = featuredBy.get(q.id);
    if (group) {
      group.items.push({
        question: q.question_text,
        answer,
        ...(featured?.is_featured !== undefined ? { isFeatured: featured.is_featured === true, featuredOrder: featured.featured_order ?? null } : {}),
      });
    }
  }
  return groups.filter((g) => g.items.length > 0);
}

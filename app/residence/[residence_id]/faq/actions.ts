"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  answerResidenceQuestion,
  hideResidenceQuestion,
  restoreResidenceQuestion,
} from "@/lib/faq/moderateResidenceQuestion";
import { saveCatalogItem } from "@/lib/faq/residenceCatalog";
import { saveFeaturedFaq } from "@/lib/faq/featured";
import { saveOwnFaq } from "@/lib/residences/ownFaqSave";
import { parseFaqBatchInput, summarizeFaqBatch, type FaqBatchItemResult, type FaqBatchResult } from "@/lib/faq/faqEditor";

export type FaqModerationState = { status: "idle" | "saved" | "error"; message?: string };

/**
 * Responder / ocultar / restaurar una pregunta libre de la ficha (D9 / H12).
 * El `intent` llega en el `name`/`value` del botón submit. Validación,
 * pertenencia a la residencia y auditoría viven en `lib/faq/moderateResidenceQuestion`.
 */
export async function moderateFaqQuestionAction(
  residenceId: string,
  questionId: string,
  _prev: FaqModerationState,
  formData: FormData,
): Promise<FaqModerationState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const base = { actorUserId: sessionUser.id, residenceId, questionId };
  const intent = String(formData.get("intent") ?? "");

  let result;
  if (intent === "answer") result = await answerResidenceQuestion(admin, { ...base, answer: formData.get("answer") });
  else if (intent === "hide") result = await hideResidenceQuestion(admin, base);
  else if (intent === "restore") result = await restoreResidenceQuestion(admin, base);
  else return { status: "error", message: "Acción no válida." };

  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/faq`);
  revalidatePath(`/residence/${residenceId}/profile`);
  revalidatePath("/residencias/[slug]", "page");
  return { status: "saved" };
}

/**
 * Guardar en lote lo que se edita en esta pantalla: preguntas del catálogo (mostrar / ocultar + respuesta, DR14) y preguntas propias.
 * La usan el «Guardar» de cada pregunta (un solo ítem), el de las preguntas propias y «Guardar todo y volver». El cliente manda solo lo
 * que cambió. Cada pregunta del catálogo se valida y se audita en `lib/faq/residenceCatalog` (permiso `faq.manage`); las propias, en
 * `lib/residences/ownFaqSave` (permiso `profile.edit`). Un ítem que falla no frena a los demás: el resultado trae el estado de cada uno.
 */
export async function saveFaqBatchAction(residenceId: string, rawInput: unknown): Promise<FaqBatchResult> {
  const fail = (message: string): FaqBatchResult => ({ status: "error", message, catalog: {} });
  const sessionUser = await getSessionUser();
  if (!sessionUser) return fail("Tu sesión expiró. Volvé a iniciar sesión.");
  const admin = getSupabaseAdmin();
  if (!admin) return fail("No disponible en este momento. Probá más tarde.");
  if (typeof residenceId !== "string" || !residenceId) return fail("No encontramos la residencia.");

  const parsed = parseFaqBatchInput(rawInput);
  if (!parsed.ok) return fail(parsed.error);
  const { catalog, own } = parsed.value;

  const catalogResults: Record<string, FaqBatchItemResult> = {};
  for (const item of catalog) {
    const result = await saveCatalogItem(admin, {
      actorUserId: sessionUser.id,
      residenceId,
      questionId: item.id,
      selected: item.selected,
      answer: item.answer,
    });
    catalogResults[item.id] = result.ok ? { ok: true, selected: result.selected } : { ok: false, error: result.error };
  }

  let ownResult: FaqBatchResult["own"];
  if (own !== null) {
    const saved = await saveOwnFaq(admin, { actorUserId: sessionUser.id, residenceId, items: own });
    ownResult = saved.ok ? { ok: true } : { ok: false, error: saved.error };
  }

  const status = summarizeFaqBatch(catalogResults, ownResult);
  if (status !== "error") {
    revalidatePath(`/residence/${residenceId}/faq`);
    revalidatePath(`/residence/${residenceId}/profile`);
    revalidatePath("/residencias/[slug]", "page");
  }
  return { status, catalog: catalogResults, ...(ownResult ? { own: ownResult } : {}) };
}

export type FaqFeaturedResult = { status: "success"; count: number } | { status: "error"; message: string };

/**
 * Elegir cuáles preguntas se destacan en la ficha (hasta 6) y en qué orden. El permiso (`faq.manage`), la validación (que cada pregunta
 * sea de ESTA residencia y hoy se muestre, sin repetidos, máximo 6) y la auditoría viven en `lib/faq/featured`.
 */
export async function saveFeaturedFaqAction(residenceId: string, refs: unknown): Promise<FaqFeaturedResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };
  if (typeof residenceId !== "string" || !residenceId) return { status: "error", message: "No encontramos la residencia." };

  const result = await saveFeaturedFaq(admin, { actorUserId: sessionUser.id, residenceId, refs });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/faq`);
  revalidatePath(`/residence/${residenceId}/profile`);
  revalidatePath("/residencias/[slug]", "page");
  return { status: "success", count: result.count };
}

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
  revalidatePath("/residencias/[slug]", "page");
  return { status: "saved" };
}

export type FaqCatalogState = { status: "idle" | "saved" | "error"; message?: string };

/**
 * Elegir mostrar / ocultar una pregunta del catálogo único y editar su respuesta (DR14). El permiso (`faq.manage`), la validación de los
 * campos `{…}` y la auditoría viven en `lib/faq/residenceCatalog`. El interruptor «Mostrar» viaja como checkbox nativo del mismo formulario.
 */
export async function saveFaqCatalogItemAction(
  residenceId: string,
  questionId: string,
  _prev: FaqCatalogState,
  formData: FormData,
): Promise<FaqCatalogState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await saveCatalogItem(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    questionId,
    selected: formData.get("selected") === "on",
    answer: formData.get("answer"),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/faq`);
  revalidatePath("/residencias/[slug]", "page");
  return { status: "saved", message: result.selected ? "Listo, la pregunta se muestra en tu ficha." : "Listo, la pregunta no se muestra en tu ficha." };
}

"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resetShareTemplate, saveShareTemplate } from "@/lib/share/shareMessage";

export type ShareActionResult = { status: "success"; template: string } | { status: "error"; message: string };

/**
 * Guarda el mensaje de WhatsApp propio de la residencia. El permiso (`profile.edit`), la validación (máx. 1.000 caracteres, con `{LINK}`,
 * solo placeholders conocidos) y la auditoría viven en `lib/share/shareMessage`. Nunca se confía en lo que manda el cliente.
 */
export async function saveShareMessageAction(residenceId: string, template: string): Promise<ShareActionResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };
  if (typeof residenceId !== "string" || !residenceId) return { status: "error", message: "No encontramos la residencia." };

  const result = await saveShareTemplate(admin, { actorUserId: sessionUser.id, residenceId, template });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/share`);
  return { status: "success", template: result.message };
}

/** Vuelve al mensaje original. Mismo permiso y auditoría que guardar. */
export async function resetShareMessageAction(residenceId: string): Promise<ShareActionResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };
  if (typeof residenceId !== "string" || !residenceId) return { status: "error", message: "No encontramos la residencia." };

  const result = await resetShareTemplate(admin, { actorUserId: sessionUser.id, residenceId });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/share`);
  return { status: "success", template: result.message };
}

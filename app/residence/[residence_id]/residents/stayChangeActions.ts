"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { respondStayChangeIntent } from "@/lib/stayChange/respondStayChangeIntent";

export type StayChangeResponseState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * La residencia actual responde (o edita su respuesta) al aviso "Quiero cambiar" de un residente (DR3, Ciclo 59).
 * La autorización real (owner/staff activo de la residencia del aviso) se valida en `respondStayChangeIntent`.
 * Campos del FormData: `message`, `exit_costs_text`, `exit_costs_usd`, `exit_conditions_text`, `exit_details_text`.
 */
export async function respondStayChangeIntentAction(
  residenceId: string,
  intentId: string,
  _prev: StayChangeResponseState,
  formData: FormData,
): Promise<StayChangeResponseState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const result = await respondStayChangeIntent(admin, {
    actorUserId: sessionUser.id,
    intentId,
    message: formData.get("message"),
    exitCostsText: formData.get("exit_costs_text"),
    exitCostsUsd: formData.get("exit_costs_usd"),
    exitConditionsText: formData.get("exit_conditions_text"),
    exitDetailsText: formData.get("exit_details_text"),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}`);
  return {
    status: "saved",
    message: result.edited
      ? "Actualizamos tu respuesta. Tu residente y su familiar vinculado la ven en Mi residencia."
      : "Respuesta enviada. Tu residente y su familiar vinculado la ven en Mi residencia. Podés editarla mientras el aviso siga abierto.",
  };
}

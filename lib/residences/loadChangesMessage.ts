import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "@/lib/residences/changesRequest";

/**
 * Mensaje que el admin le dejó a la residencia al pedir cambios (DR5). Se lee con service role: la columna no es
 * legible por el cliente de sesión (migración 0048) y NUNCA se lee `notes_internal`. Devuelve `null` si no hay mensaje o
 * si la 0048 todavía no está aplicada (degrada al copy genérico).
 */
export async function loadChangesMessage(admin: SupabaseClient, residenceId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("residence_verifications")
    .select("changes_requested_message")
    .eq("residence_id", residenceId)
    .maybeSingle();
  if (error) {
    if (!isMissingColumnError(error)) console.error("[residences] loadChangesMessage failed:", error);
    return null;
  }
  const message = (data?.changes_requested_message as string | null | undefined)?.trim();
  return message ? message : null;
}

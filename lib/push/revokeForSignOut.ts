import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Al cerrar sesión se revocan las suscripciones push de ese usuario en ESTE navegador (mismo `user_agent`): en un
 * dispositivo compartido, los avisos de la cuenta anterior no deberían seguir llegando. Nunca lanza.
 */
export async function revokePushForSignOut(admin: SupabaseClient, userId: string, userAgent: string | null): Promise<void> {
  if (!userAgent) return;
  try {
    await admin
      .from("push_subscriptions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("user_agent", userAgent.slice(0, 300))
      .is("revoked_at", null);
  } catch (error) {
    console.error("[push] revoke on sign-out failed:", error instanceof Error ? error.message : error);
  }
}

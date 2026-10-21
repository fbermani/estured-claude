import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Marca como leída UNA notificación, solo si es del usuario indicado (H20).
 * La barrera de pertenencia es el filtro `user_id`: como la escritura va por
 * service role (no hay policy de UPDATE para `authenticated`, a propósito),
 * un id ajeno simplemente no coincide y no se toca nada. Devuelve cuántas
 * filas cambió (0 o 1) para poder testear la regla.
 */
export async function markNotificationReadForUser(
  admin: SupabaseClient,
  userId: string,
  notificationId: string,
): Promise<number> {
  if (typeof notificationId !== "string" || !UUID_RE.test(notificationId)) return 0;
  const { data, error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");
  if (error) {
    console.error("[notifications] markRead failed:", error.code, error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/** Marca como leídas todas las notificaciones sin leer del usuario. Devuelve cuántas cambió. */
export async function markAllNotificationsReadForUser(admin: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");
  if (error) {
    console.error("[notifications] markAllRead failed:", error.code, error.message);
    return 0;
  }
  return data?.length ?? 0;
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notificación in-app mínima (docs/00 §29 define un NotificationProvider
 * completo con email/push, todavía no construido — ver GAPS.md). Nunca
 * lanza, mismo criterio que `createAuditLog`: un aviso que falla no debe
 * poder tumbar la acción de negocio que lo generó.
 */
export async function createNotification(
  admin: SupabaseClient,
  entry: {
    userId: string;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  },
): Promise<void> {
  const { error } = await admin.from("notifications").insert({
    user_id: entry.userId,
    title: entry.title,
    body: entry.body,
    related_entity_type: entry.relatedEntityType ?? null,
    related_entity_id: entry.relatedEntityId ?? null,
  });
  if (error) {
    console.error("[notifications] insert failed:", error.code, error.message);
  }
}

import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationCategory } from "@/lib/notifications/categories";
import { dispatchNotificationPush } from "@/lib/push/dispatch";

/**
 * Notificación in-app (docs/00 §29) y, si la categoría es elegible, push web (DR61). Nunca
 * lanza, mismo criterio que `createAuditLog`: un aviso que falla no debe poder tumbar la acción
 * de negocio que lo generó.
 *
 * `category`: por defecto `none` (solo in-app). Con una categoría de push el envío va fuera de la
 * ruta crítica: `after()` mantiene viva la función en Vercel y, fuera de un request (jobs, tests),
 * se espera dentro de un `try/catch`.
 */
export async function createNotification(
  admin: SupabaseClient,
  entry: {
    userId: string;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    category?: NotificationCategory;
  },
): Promise<void> {
  const category = entry.category ?? "none";
  const base = {
    user_id: entry.userId,
    title: entry.title,
    body: entry.body,
    related_entity_type: entry.relatedEntityType ?? null,
    related_entity_id: entry.relatedEntityId ?? null,
  };

  if (category === "none") {
    const { error } = await admin.from("notifications").insert(base);
    if (error) console.error("[notifications] insert failed:", error.code, error.message);
    return;
  }

  const { data, error } = await admin.from("notifications").insert({ ...base, category }).select("id").single();
  if (error?.code === "42703" || error?.code === "PGRST204") {
    // Migración 0101 sin aplicar: el aviso in-app sale igual, sin push.
    const { error: retryError } = await admin.from("notifications").insert(base);
    if (retryError) console.error("[notifications] insert failed:", retryError.code, retryError.message);
    return;
  }
  if (error || !data?.id) {
    console.error("[notifications] insert failed:", error?.code, error?.message);
    return;
  }
  const row = { id: data.id as string, user_id: entry.userId, category };
  await runAfterResponse(() => dispatchNotificationPush(admin, row));
}

async function runAfterResponse(task: () => Promise<void>): Promise<void> {
  try {
    after(task);
  } catch {
    // Fuera de un request (jobs de cron, tests): se espera acá, y `task` nunca lanza.
    await task();
  }
}

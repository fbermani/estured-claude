import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyAdmins } from "@/lib/audit";
import type { NotificationCategory } from "@/lib/notifications/categories";

/**
 * Aviso a admin/superadmin que NUNCA lanza (ni siquiera si falla la lectura de los admin): lo usan los emisores de avisos
 * administrativos (registros, Soporte, revisiones) para que un aviso caído no pueda tumbar la mutación de negocio.
 * Categoría por defecto `admin_requests`; los registros usan `admin_signups`.
 */
export async function notifyAdminsSafe(
  admin: SupabaseClient,
  params: { title: string; body: string; entityType: string; entityId: string; category?: NotificationCategory },
): Promise<void> {
  try {
    await notifyAdmins(admin, { ...params, category: params.category ?? "admin_requests" });
  } catch (error) {
    console.error("[notifications] notifyAdminsSafe failed:", error);
  }
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";

/**
 * Aviso in-app a TODOS los superadmin activos (DR66 (a): escalado a los 7 días de un aviso de pago sin respuesta). Nunca lanza.
 * Devuelve `true` solo si había a quién avisar y la lectura no falló: si devuelve `false` el job libera su marca y reintenta en la
 * próxima corrida (no se pierde el escalado). Sin datos de cobro ni montos en el texto.
 */
export async function notifySuperadminsCounted(
  admin: SupabaseClient,
  params: { title: string; body: string; entityType: string; entityId: string },
): Promise<boolean> {
  try {
    const { data, error } = await admin.from("user_roles").select("user_id").eq("role", "superadmin").eq("is_active", true);
    if (error) return false;
    const ids = [...new Set((data ?? []).map((r) => r.user_id as string))];
    if (ids.length === 0) return false;
    await Promise.all(
      ids.map((userId) =>
        createNotification(admin, {
          userId,
          title: params.title,
          body: params.body,
          relatedEntityType: params.entityType,
          relatedEntityId: params.entityId,
          category: "admin_requests",
        }),
      ),
    );
    return true;
  } catch (error) {
    console.error("[notifications] notifySuperadminsCounted failed:", error);
    return false;
  }
}

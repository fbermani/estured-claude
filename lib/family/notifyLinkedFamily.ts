import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import type { NotificationCategory } from "@/lib/notifications/categories";
import { formatShortName } from "@/lib/format/shortName";
import { loadActiveFamilyUserIds } from "@/lib/stayChange/recipients";

/**
 * Aviso in-app al familiar ACTIVO de un estudiante (DR4, docs/00 §31): solo hitos clave y pagos — propuestas, solicitud
 * aceptada, pago a la residencia, fee y su plazo, reserva confirmada, comprobante y vencimientos. NUNCA mensajes privados
 * ni movimientos menores. Mismo criterio que `createNotification`: nunca lanza, un aviso que no sale no tumba la acción
 * de negocio. Usa `loadActiveFamilyUserIds` (la misma fuente que ya usa "Quiero cambiar", DR3): sin duplicar lógica.
 *
 * `excludeUserIds` evita avisarle dos veces a quien ya recibió un aviso propio por otra vía (p. ej. el pagador designado).
 */
export async function notifyLinkedFamily(
  admin: SupabaseClient,
  studentProfileId: string | null | undefined,
  entry: { title: string; body: string; relatedEntityType?: string; relatedEntityId?: string; category?: NotificationCategory },
  options: { excludeUserIds?: string[] } = {},
): Promise<void> {
  if (!studentProfileId) return;
  try {
    const exclude = new Set(options.excludeUserIds ?? []);
    const userIds = (await loadActiveFamilyUserIds(admin, studentProfileId)).filter((id) => !exclude.has(id));
    for (const userId of userIds) {
      await createNotification(admin, { userId, ...entry });
    }
  } catch (error) {
    console.error("[family] notifyLinkedFamily failed:", error);
  }
}

/** "Lucía F." para hablar del estudiante en tercera persona. */
export async function loadStudentShortName(admin: SupabaseClient, studentProfileId: string): Promise<string> {
  const { data } = await admin
    .from("student_profiles")
    .select("first_name, last_initial")
    .eq("id", studentProfileId)
    .maybeSingle();
  if (!data?.first_name) return "el estudiante";
  return formatShortName(data.first_name as string, data.last_initial as string | null);
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

export type SetResidencePausedByAdminResult = { status: "ok" } | { status: "error"; message: string };

/**
 * `residences.status` ya tenía `paused_by_admin` en el enum (docs/06 §8.1)
 * desde el Ciclo 2-3 — docs/12 Fase 11 lo nombra explícitamente ("admin
 * puede... penalizar o suspender residencias") pero nada lo seteaba
 * nunca, mismo patrón que el resto de los estados "de admin" encontrados
 * este ciclo. Pausar oculta la residencia del catálogo público y bloquea
 * solicitudes nuevas (`residencias/page.tsx`, `[slug]/page.tsx`,
 * `students/applications/actions.ts` ya filtran/exigen `verified_active`
 * — no hizo falta tocar esos archivos). No toca reservas/solicitudes ya
 * en curso: pausar una residencia no es lo mismo que suspenderla por
 * rechazo de verificación (`/admin/verifications`, flujo ya existente).
 */
export async function setResidencePausedByAdmin(
  admin: SupabaseClient,
  params: { residenceId: string; actorUserId: string; actorRole: string; paused: boolean; reason: string },
): Promise<SetResidencePausedByAdminResult> {
  const reason = params.reason.trim();
  if (params.paused && reason.length < 5) return { status: "error", message: "El motivo de la pausa es obligatorio." };

  const { data: residence } = await admin
    .from("residences")
    .select("id, status, name")
    .eq("id", params.residenceId)
    .maybeSingle();
  if (!residence) return { status: "error", message: "Residencia no encontrada." };

  const requiredCurrentStatus = params.paused ? "verified_active" : "paused_by_admin";
  if (residence.status !== requiredCurrentStatus) {
    return {
      status: "error",
      message: params.paused
        ? "Solo se pueden pausar residencias activas y publicadas."
        : "Solo se pueden reactivar residencias pausadas por admin.",
    };
  }

  const newStatus = params.paused ? "paused_by_admin" : "verified_active";
  const { error } = await admin.from("residences").update({ status: newStatus }).eq("id", residence.id);
  if (error) {
    console.error("[residences] setResidencePausedByAdmin update failed:", error);
    return { status: "error", message: "No pudimos actualizar la residencia. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: params.paused ? "residence_paused_by_admin" : "residence_reactivated_by_admin",
    entityType: "residences",
    entityId: residence.id,
    oldValue: { status: residence.status },
    newValue: { status: newStatus },
    reasonText: params.paused ? reason : undefined,
    source: "admin",
  });

  const { data: residenceUsers } = await admin
    .from("residence_users")
    .select("user_id")
    .eq("residence_id", residence.id)
    .eq("is_active", true);
  const title = params.paused ? "EstuRed pausó tu residencia" : "EstuRed reactivó tu residencia";
  const body = params.paused
    ? `${residence.name} quedó pausada y no aparece en el catálogo hasta que se reactive. Motivo: ${reason}`
    : `${residence.name} volvió a estar activa y visible en el catálogo.`;
  for (const ru of residenceUsers ?? []) {
    await createNotification(admin, {
      userId: ru.user_id,
      title,
      body,
      relatedEntityType: "residences",
      relatedEntityId: residence.id,
    });
  }

  return { status: "ok" };
}

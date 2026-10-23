import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { saveResidencePrivateDetails } from "@/lib/residences/privateDetails";
import { createNotification } from "@/lib/notifications/createNotification";

export type QualityVisibilityStatus = "normal_visibility" | "warning" | "reduced_visibility";

export type SetQualityVisibilityResult = { status: "ok" } | { status: "error"; message: string };

const ACTION_BY_STATUS: Record<QualityVisibilityStatus, string> = {
  warning: "residence_visibility_warning_issued",
  reduced_visibility: "residence_visibility_reduced",
  normal_visibility: "residence_visibility_restored",
};

const NOTIFICATION_COPY: Record<QualityVisibilityStatus, { title: string; body: (residenceName: string, reason: string) => string }> = {
  warning: {
    title: "EstuRed te emitió una advertencia",
    body: (name, reason) => `Recibiste una advertencia de calidad para ${name}. Motivo: ${reason}`,
  },
  reduced_visibility: {
    title: "EstuRed redujo la visibilidad de tu residencia",
    body: (name, reason) => `La visibilidad de ${name} fue reducida. Motivo: ${reason}`,
  },
  normal_visibility: {
    title: "EstuRed restauró la visibilidad normal de tu residencia",
    body: (name, reason) => `La visibilidad de ${name} volvió a la normalidad. Motivo: ${reason}`,
  },
};

/**
 * Visibilidad y penalizaciones de calidad (docs/09 §23, migración 0031).
 * Cubre SOLO los 3 estados sin equivalente en `residences.status`
 * (`normal_visibility`/`warning`/`reduced_visibility`) — pausar/suspender/
 * remover de la red ya existen como transiciones de `status` en
 * `/admin/residences` y no se duplican acá. Sin motor de ranking
 * automático (docs §23.2/23.3): esta función solo aplica la decisión
 * manual del admin, auditada y notificada al dueño de residencia.
 */
export async function setQualityVisibilityByAdmin(
  admin: SupabaseClient,
  params: {
    residenceId: string;
    actorUserId: string;
    actorRole: string;
    newStatus: QualityVisibilityStatus;
    reason: string;
  },
): Promise<SetQualityVisibilityResult> {
  const reason = params.reason.trim();
  if (reason.length < 5) return { status: "error", message: "El motivo es obligatorio." };

  const { data: residence } = await admin.from("residences").select("id, name").eq("id", params.residenceId).maybeSingle();
  if (!residence) return { status: "error", message: "Residencia no encontrada." };

  // Ciclo 56: la señal de calidad es interna (no legible con la anon key): vive en `residence_private_details`.
  const error = await saveResidencePrivateDetails(admin, params.residenceId, {
    quality_visibility_status: params.newStatus,
  });
  if (error) {
    console.error("[residences] setQualityVisibilityByAdmin update failed:", error);
    return { status: "error", message: "No pudimos guardar el cambio. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: ACTION_BY_STATUS[params.newStatus],
    entityType: "residences",
    entityId: params.residenceId,
    newValue: { quality_visibility_status: params.newStatus },
    reasonText: reason,
    source: "admin",
  });

  const copy = NOTIFICATION_COPY[params.newStatus];
  const { data: residenceUsers } = await admin
    .from("residence_users")
    .select("user_id")
    .eq("residence_id", params.residenceId)
    .eq("is_active", true);
  for (const ru of residenceUsers ?? []) {
    await createNotification(admin, {
      userId: ru.user_id,
      title: copy.title,
      body: copy.body(residence.name, reason),
      relatedEntityType: "residences",
      relatedEntityId: params.residenceId,
    });
  }

  return { status: "ok" };
}

/**
 * Nota interna (docs/09 §23.4) — a diferencia de las acciones de arriba,
 * NO cambia ningún estado ni notifica al dueño de residencia: es
 * exclusivamente una anotación para uso interno del equipo de EstuRed.
 * Reusa `audit_logs.reason_text` como cuerpo de la nota — no hace falta
 * una tabla nueva solo para esto.
 */
export async function addResidenceInternalNote(
  admin: SupabaseClient,
  params: { residenceId: string; actorUserId: string; actorRole: string; note: string },
): Promise<SetQualityVisibilityResult> {
  const note = params.note.trim();
  if (note.length < 5) return { status: "error", message: "La nota es obligatoria." };

  const { data: residence } = await admin.from("residences").select("id").eq("id", params.residenceId).maybeSingle();
  if (!residence) return { status: "error", message: "Residencia no encontrada." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "residence_internal_note_added",
    entityType: "residences",
    entityId: params.residenceId,
    reasonText: note,
    source: "admin",
  });

  return { status: "ok" };
}

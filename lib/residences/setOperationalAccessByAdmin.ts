import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

export type SetOperationalAccessResult = { status: "ok" } | { status: "error"; message: string };

/**
 * Mecanismo de acceso freemium a Gestión Operativa (docs/12 §15.3,
 * migración 0030) — el dueño de EstuRed define a quién se le otorga y
 * por cuánto tiempo (fecha límite opcional, para pioneras); esta
 * función solo aplica esa decisión, auditada y notificada. No valida
 * ni gatea ningún feature de "Gestión Operativa" — ese modo no existe
 * todavía en el producto.
 */
export async function setOperationalAccessByAdmin(
  admin: SupabaseClient,
  params: {
    residenceId: string;
    actorUserId: string;
    actorRole: string;
    granted: boolean;
    reason: string;
    expiresAt: string | null;
  },
): Promise<SetOperationalAccessResult> {
  const reason = params.reason.trim();
  if (reason.length < 5) return { status: "error", message: "El motivo es obligatorio." };

  const { data: residence } = await admin.from("residences").select("id, name").eq("id", params.residenceId).maybeSingle();
  if (!residence) return { status: "error", message: "Residencia no encontrada." };

  const { error } = await admin
    .from("residences")
    .update({
      has_operational_management_access: params.granted,
      operational_access_granted_by: params.actorUserId,
      operational_access_granted_at: new Date().toISOString(),
      operational_access_reason: reason,
      pioneer_free_access_until: params.granted ? params.expiresAt : null,
    })
    .eq("id", params.residenceId);
  if (error) {
    console.error("[residences] setOperationalAccessByAdmin update failed:", error);
    return { status: "error", message: "No pudimos guardar el cambio. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: params.granted ? "operational_access_granted" : "operational_access_revoked",
    entityType: "residences",
    entityId: params.residenceId,
    newValue: { granted: params.granted, expires_at: params.expiresAt },
    reasonText: reason,
    source: "admin",
  });

  const { data: residenceUsers } = await admin
    .from("residence_users")
    .select("user_id")
    .eq("residence_id", params.residenceId)
    .eq("is_active", true);
  const title = params.granted ? "EstuRed activó tu acceso a Gestión Operativa" : "EstuRed revocó tu acceso a Gestión Operativa";
  const body = params.granted
    ? `Tu residencia ${residence.name} ya tiene acceso a Gestión Operativa.${params.expiresAt ? ` Válido hasta el ${params.expiresAt}.` : ""} Motivo: ${reason}`
    : `Tu residencia ${residence.name} ya no tiene acceso a Gestión Operativa. Motivo: ${reason}`;
  for (const ru of residenceUsers ?? []) {
    await createNotification(admin, {
      userId: ru.user_id,
      title,
      body,
      relatedEntityType: "residences",
      relatedEntityId: params.residenceId,
    });
  }

  return { status: "ok" };
}

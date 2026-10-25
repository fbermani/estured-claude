import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { getResidencePrivateDetails, saveResidencePrivateDetails } from "@/lib/residences/privateDetails";

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

  // Ciclo 56: la auditoría interna del acceso (quién, cuándo, motivo en texto libre) es privada. Se guarda PRIMERO:
  // si falla el cambio del flag, queda un registro de más (inofensivo) y no un acceso otorgado sin registro.
  const previous = await getResidencePrivateDetails(admin, params.residenceId);
  const privateError = await saveResidencePrivateDetails(admin, params.residenceId, {
    operational_access_granted_by: params.actorUserId,
    operational_access_granted_at: new Date().toISOString(),
    operational_access_reason: reason,
  });
  if (privateError) return { status: "error", message: "No pudimos guardar el cambio. Probá de nuevo." };

  const { error } = await admin
    .from("residences")
    .update({
      has_operational_management_access: params.granted,
      pioneer_free_access_until: params.granted ? params.expiresAt : null,
    })
    .eq("id", params.residenceId);
  if (error) {
    console.error("[residences] setOperationalAccessByAdmin update failed:", error);
    // Mejor esfuerzo: volver al registro anterior para que no describa un cambio que no ocurrió.
    await saveResidencePrivateDetails(admin, params.residenceId, {
      operational_access_granted_by: previous?.operational_access_granted_by ?? null,
      operational_access_granted_at: previous?.operational_access_granted_at ?? null,
      operational_access_reason: previous?.operational_access_reason ?? null,
    });
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

  // DR12/D8 (2026-10-25): sin pantallas de plan y con todo habilitado, NO se avisa a la residencia
  // («EstuRed activó/revocó tu acceso…»). Se retoma cuando haya precio.

  return { status: "ok" };
}

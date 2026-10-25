import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";

export type UpdateAvailabilityResult = { ok: true } | { ok: false; error: string };

const ALLOWED_STATUSES = ["available_to_confirm", "full", "paused_by_residence"];

/**
 * Docs/06 §9.4, docs/04 §10.2/§10.4 — la residencia actualiza su propia
 * disponibilidad declarada (Modo Perfil Verificado). No puede setear
 * `not_updated` (lo calcula el job `checkStaleAvailability`) ni
 * `paused_by_admin` (solo EstuRed). Cualquier actualización de la
 * residencia limpia `hidden_from_search_at` y resetea el reloj de los
 * 30 días (`last_confirmed_at`).
 */
export async function updateAvailability(
  admin: SupabaseClient,
  params: {
    roomTypeId: string;
    actorUserId: string;
    status: string;
    availableCount: number | null;
    availableFrom: string | null;
    notesPublic: string | null;
  },
): Promise<UpdateAvailabilityResult> {
  if (!ALLOWED_STATUSES.includes(params.status)) {
    return { ok: false, error: "Estado de disponibilidad inválido." };
  }

  const { data: roomType } = await admin
    .from("room_types")
    .select("id, residence_id")
    .eq("id", params.roomTypeId)
    .maybeSingle();
  if (!roomType) return { ok: false, error: "No encontramos ese tipo de habitación." };

  const access = await assertResidencePermission(admin, params.actorUserId, roomType.residence_id, "operations.rooms_availability");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;

  const { data: current } = await admin
    .from("profile_availability")
    .select("id, status")
    .eq("room_type_id", params.roomTypeId)
    .eq("residence_id", roomType.residence_id)
    .maybeSingle();
  if (!current) return { ok: false, error: "No encontramos la disponibilidad de ese tipo de habitación." };
  if (current.status === "paused_by_admin") {
    return { ok: false, error: "EstuRed pausó esta disponibilidad — contactá a soporte." };
  }

  const { error } = await admin
    .from("profile_availability")
    .update({
      status: params.status,
      available_count: params.availableCount,
      available_from: params.availableFrom,
      notes_public: params.notesPublic,
      last_confirmed_by: params.actorUserId,
      last_confirmed_at: new Date().toISOString(),
      hidden_from_search_at: null,
    })
    .eq("id", current.id)
    .eq("residence_id", roomType.residence_id);
  if (error) {
    console.error("[availability] updateAvailability failed:", error);
    return { ok: false, error: "No pudimos actualizar la disponibilidad. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: "availability_updated",
    entityType: "profile_availability",
    entityId: current.id,
    newValue: { permission: access.permission, status: params.status, available_count: params.availableCount },
  });

  return { ok: true };
}

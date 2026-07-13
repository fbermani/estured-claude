import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { ROOM_TYPE_VISIBLE_STATUSES } from "@/lib/applications/types";

/**
 * Docs/03 §10.3-10.4 — cola por tipo de habitación en Modo Perfil
 * Verificado (donde no existen plazas individuales; la variante por
 * `place_id` en Gestión Operativa queda fuera de alcance hasta que
 * exista la Fase 9bis de activación del flag, docs/12 §9.3).
 */
export const MAX_VISIBLE_PER_ROOM_TYPE = 3;
export const MAX_QUEUED_PER_ROOM_TYPE = 2;

async function countByStatus(admin: SupabaseClient, roomTypeId: string, statuses: string[]): Promise<number> {
  const { count } = await admin
    .from("application_requests")
    .select("id", { count: "exact", head: true })
    .eq("room_type_id", roomTypeId)
    .in("status", statuses);
  return count ?? 0;
}

export type InitialApplicationStatus =
  | { status: "submitted" }
  | { status: "queued_for_place" }
  | { error: string };

/**
 * Determina si una solicitud nueva entra directo (`submitted`) o en cola
 * (`queued_for_place`), o si la cola ya está completa.
 */
export async function determineInitialApplicationStatus(
  admin: SupabaseClient,
  roomTypeId: string,
): Promise<InitialApplicationStatus> {
  const visibleCount = await countByStatus(admin, roomTypeId, ROOM_TYPE_VISIBLE_STATUSES);
  if (visibleCount < MAX_VISIBLE_PER_ROOM_TYPE) return { status: "submitted" };

  const queuedCount = await countByStatus(admin, roomTypeId, ["queued_for_place"]);
  if (queuedCount < MAX_QUEUED_PER_ROOM_TYPE) return { status: "queued_for_place" };

  return { error: "Este tipo de habitación ya tiene el máximo de solicitudes en curso y la cola está completa. Probá sumarte a la lista de espera o elegir otro tipo." };
}

/**
 * Se llama cada vez que una solicitud deja el set visible de un tipo de
 * habitación (rechazo, cancelación, vencimiento, conversión a reserva,
 * cierre por otra reserva confirmada) para promover la más antigua en
 * cola. Nunca lanza (mismo criterio que `removeWaitlistEntriesOnConfirmedReservation`):
 * es un efecto secundario, no debe poder tumbar la operación principal.
 */
export async function promoteNextQueuedApplication(admin: SupabaseClient, roomTypeId: string): Promise<void> {
  try {
    const visibleCount = await countByStatus(admin, roomTypeId, ROOM_TYPE_VISIBLE_STATUSES);
    if (visibleCount >= MAX_VISIBLE_PER_ROOM_TYPE) return;

    const { data: next, error } = await admin
      .from("application_requests")
      .select("id")
      .eq("room_type_id", roomTypeId)
      .eq("status", "queued_for_place")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !next) return;

    const { error: updateError } = await admin
      .from("application_requests")
      .update({ status: "submitted" })
      .eq("id", next.id)
      .eq("status", "queued_for_place");
    if (updateError) return;

    await admin.from("application_status_events").insert({
      application_request_id: next.id,
      from_status: "queued_for_place",
      to_status: "submitted",
      changed_by_role: "system",
      reason_text: "Se liberó un cupo visible para este tipo de habitación.",
    });
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "application_promoted_from_queue",
      entityType: "application_requests",
      entityId: next.id,
      source: "system",
    });
  } catch (error) {
    console.error("[applications] promoteNextQueuedApplication failed:", error);
  }
}

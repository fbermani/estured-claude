import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { ROOM_GENDERS, isRoomGender, type RoomGender } from "@/lib/residences/roomGender";
import {
  candidateGenders,
  genderRowTitle,
  parseGenderRow,
  rollupTypeAvailability,
  roomGendersOfType,
  type GenderRow,
  type GenderRowRaw,
} from "@/lib/availability/genderAvailability";

export type UpdateGenderAvailabilityResult = { ok: true; rows: number } | { ok: false; error: string };

const MISSING_SCHEMA_MESSAGE = "La disponibilidad por género todavía no está disponible. Probá de nuevo más tarde.";

/**
 * Disponibilidad de UN tipo de habitación, detallada por género (migración 0075). La residencia confirma o ajusta una fila por cada género que
 * tiene habitaciones en el tipo (cantidad, «desde», nota pública y estado). Todo se valida acá, en el servidor:
 *  - permiso `operations.rooms_availability` (dueño o staff con el casillero) y tipo de ESTA residencia (IDOR);
 *  - los géneros enviados tienen que ser exactamente los que tiene el tipo hoy (no se aceptan filas inventadas ni faltantes);
 *  - `paused_by_admin` no se toca desde acá (solo EstuRed la levanta).
 * Después guarda las filas, quita las de géneros que ya no existen en el tipo y recalcula el RESUMEN del tipo en `profile_availability`
 * (el que leen solicitudes, reservas, lista de espera y los jobs de vencimiento); guardar resetea el reloj de los 30 días del tipo y lo
 * vuelve a mostrar en las búsquedas. Una auditoría por guardado.
 */
export async function updateTypeAvailabilityByGender(
  admin: SupabaseClient,
  params: {
    residenceId: string;
    roomTypeId: string;
    actorUserId: string;
    /** Lo enviado por el formulario, por género. */
    rows: Partial<Record<string, GenderRowRaw>>;
  },
): Promise<UpdateGenderAvailabilityResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "operations.rooms_availability");
  if (!access.ok) return { ok: false, error: access.error };

  const { data: roomType, error: typeError } = await admin
    .from("room_types")
    .select("id, name, gender_policy, capacity_per_room, is_active")
    .eq("id", params.roomTypeId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (typeError) return { ok: false, error: "No pudimos leer el tipo de habitación. Probá de nuevo en unos minutos." };
  if (!roomType || roomType.is_active === false) return { ok: false, error: "No encontramos ese tipo de habitación." };

  // "*": si la migración 0057 (rooms.gender) no está aplicada, no explota y se degrada al género del tipo.
  const { data: rooms, error: roomsError } = await admin
    .from("rooms")
    .select("*")
    .eq("room_type_id", params.roomTypeId)
    .eq("residence_id", params.residenceId)
    .eq("is_active", true);
  if (roomsError) return { ok: false, error: "No pudimos leer las habitaciones. Probá de nuevo en unos minutos." };

  const candidates = candidateGenders(
    roomGendersOfType((rooms ?? []) as { gender?: string | null }[], { policy: roomType.gender_policy, capacityPerRoom: roomType.capacity_per_room }),
    { policy: roomType.gender_policy, capacityPerRoom: roomType.capacity_per_room },
  );

  const sentGenders = Object.keys(params.rows);
  if (sentGenders.some((g) => !isRoomGender(g) || !candidates.includes(g))) {
    return { ok: false, error: "Las habitaciones de este tipo cambiaron. Recargá la página y revisá la disponibilidad de nuevo." };
  }
  const parsed: GenderRow[] = [];
  for (const gender of candidates) {
    const raw = params.rows[gender];
    const title = genderRowTitle(roomType.name as string, gender);
    if (!raw) return { ok: false, error: `Falta la disponibilidad de ${title}. Recargá la página e intentá de nuevo.` };
    const row = parseGenderRow(gender, raw, title);
    if (!row.ok) return { ok: false, error: row.error };
    parsed.push(row.row);
  }

  const { data: current, error: currentError } = await admin
    .from("profile_availability")
    .select("id, status")
    .eq("room_type_id", params.roomTypeId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (currentError) return { ok: false, error: "No pudimos leer la disponibilidad actual. Probá de nuevo en unos minutos." };
  if (current?.status === "paused_by_admin") {
    return { ok: false, error: "EstuRed pausó esta disponibilidad — contactá a soporte." };
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await admin.from("profile_availability_genders").upsert(
    parsed.map((r) => ({
      residence_id: params.residenceId,
      room_type_id: params.roomTypeId,
      gender: r.gender,
      status: r.status,
      available_count: r.availableCount,
      available_from: r.availableFrom,
      notes_public: r.notesPublic,
      last_confirmed_by: params.actorUserId,
      last_confirmed_at: now,
    })),
    { onConflict: "room_type_id,gender" },
  );
  if (upsertError) {
    if (isMissingSchemaError(upsertError)) return { ok: false, error: MISSING_SCHEMA_MESSAGE };
    console.error("[availability-genders] upsert failed:", upsertError);
    return { ok: false, error: "No pudimos guardar la disponibilidad. Intentá de nuevo." };
  }

  // Géneros que ya no existen en el tipo (se cambió el género de sus habitaciones): se quitan para que no queden ofertas fantasma.
  const stale = ROOM_GENDERS.filter((g) => !candidates.includes(g));
  if (stale.length > 0) {
    const { error: pruneError } = await admin
      .from("profile_availability_genders")
      .delete()
      .eq("room_type_id", params.roomTypeId)
      .eq("residence_id", params.residenceId)
      .in("gender", stale as RoomGender[]);
    if (pruneError) console.error("[availability-genders] no se pudieron quitar filas obsoletas:", pruneError);
  }

  // Resumen del tipo: lo único que leen los demás flujos.
  const rollup = rollupTypeAvailability(parsed);
  if (rollup) {
    const summary = {
      status: rollup.status,
      available_count: rollup.availableCount,
      available_from: rollup.availableFrom,
      last_confirmed_by: params.actorUserId,
      last_confirmed_at: now,
      hidden_from_search_at: null,
    };
    const { data: written, error: rollupError } = current
      ? await admin
          .from("profile_availability")
          .update(summary)
          .eq("id", current.id)
          .eq("residence_id", params.residenceId)
          .select("id")
          .maybeSingle()
      : await admin
          .from("profile_availability")
          .insert({ residence_id: params.residenceId, room_type_id: params.roomTypeId, ...summary })
          .select("id")
          .maybeSingle();
    if (rollupError || !written) {
      console.error("[availability-genders] no se pudo actualizar el resumen del tipo:", rollupError);
      return { ok: false, error: "Guardamos el detalle por género, pero no pudimos actualizar el resumen del tipo. Volvé a guardar." };
    }
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "availability_by_gender_updated",
    entityType: "profile_availability",
    entityId: current?.id ?? params.roomTypeId,
    newValue: {
      permission: access.permission,
      room_type_id: params.roomTypeId,
      rows: parsed.map((r) => ({ gender: r.gender, status: r.status, available_count: r.availableCount })),
      summary: rollup ? { status: rollup.status, available_count: rollup.availableCount } : null,
    },
  });

  return { ok: true, rows: parsed.length };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncRoomsAndBeds } from "@/lib/residences/syncRoomsAndBeds";
import { roundUsd, roundArs, usdToArs } from "@/lib/mock/exchange";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { inheritedGenderChange } from "@/lib/residences/roomGender";
import { logTariffChange } from "@/lib/residences/tariffLog";

/**
 * Revisión de ediciones de perfil (docs/09 §8, docs/06 §8.5, migración
 * 0027): cambios críticos a una residencia YA `verified_active` quedan
 * `pending_admin_review` en `residence_profile_edits` en vez de
 * aplicarse al instante. Solo protege residencias publicadas — el alta
 * (draft/pending_verification/needs_changes) sigue aplicando cambios
 * directo, porque esa etapa ya pasa por `/admin/verifications`.
 */
export type ProfileEditFieldGroup = "photos" | "services" | "rules" | "minimum_stay_months" | "room_types";

export interface RoomTypeEditInput {
  id?: string;
  name: string;
  genderPolicy?: string;
  bathroomType?: string;
  features: string[];
  roomCount: number;
  capacityPerRoom: number;
  monthlyPriceUsd: number;
}

interface CurrentRoomTypeSnapshot {
  id: string;
  name: string;
  genderPolicy: string | null;
  bathroomType: string | null;
  features: string[];
  roomCount: number;
  capacityPerRoom: number;
}

/**
 * Determina si el array de tipos de habitación propuesto cambia algo
 * ESTRUCTURAL (lo que se vende: qué tipos existen, cuántas
 * habitaciones/camas, género, baño, características) respecto al
 * actual. El precio (`monthlyPriceUsd`) NO es estructural — docs/09 §8.2
 * lo deja explícitamente fuera de la aprobación previa, solo auditado.
 * Si el resultado es `true`, TODO el envío de tipos de habitación de
 * este guardado queda pendiente de revisión (no se separan campos
 * dentro de la misma fila para evitar aplicar un tipo a medias).
 */
export function hasStructuralRoomTypeChange(
  current: CurrentRoomTypeSnapshot[],
  incoming: RoomTypeEditInput[],
): boolean {
  const currentById = new Map(current.map((c) => [c.id, c]));
  const incomingIds = new Set(incoming.map((rt) => rt.id).filter(Boolean) as string[]);

  // Tipo existente removido del formulario → cambio estructural.
  if (current.some((c) => !incomingIds.has(c.id))) return true;

  for (const rt of incoming) {
    // Tipo nuevo (sin id) → cambio estructural.
    if (!rt.id) return true;
    const existing = currentById.get(rt.id);
    if (!existing) return true;
    if (existing.name !== rt.name) return true;
    if ((existing.genderPolicy ?? "") !== (rt.genderPolicy ?? "")) return true;
    if ((existing.bathroomType ?? "") !== (rt.bathroomType ?? "")) return true;
    if (existing.roomCount !== rt.roomCount) return true;
    if (existing.capacityPerRoom !== rt.capacityPerRoom) return true;
    const existingFeatures = [...existing.features].sort().join(",");
    const incomingFeatures = [...rt.features].sort().join(",");
    if (existingFeatures !== incomingFeatures) return true;
  }
  return false;
}

/** Mensaje cuando el formulario trae el id de un tipo de habitación que no es de esta residencia (o que ya no existe). */
export const ROOM_TYPE_NOT_OWNED_MESSAGE =
  "Uno de los tipos de habitación no pertenece a esta residencia. Recargá la página e intentá de nuevo.";

/**
 * IDOR: el formulario del perfil manda el `id` de cada tipo de habitación y ese dato viaja del cliente. Devuelve los ids entrantes que NO
 * están entre los tipos de ESTA residencia (activos o no). Puro: quien llama le pasa los ids que leyó de la base filtrando por residencia.
 */
export function findForeignRoomTypeIds(ownIds: Iterable<string>, incoming: { id?: string }[]): string[] {
  const own = new Set(ownIds);
  return incoming.map((rt) => rt.id).filter((id): id is string => !!id && !own.has(id));
}

/**
 * Valida (leyendo la base, filtrando por residencia) que todo `rt.id` entrante sea un tipo de habitación de ESTA residencia. Se llama ANTES
 * de escribir nada: un id de otra residencia rechaza el guardado completo. Sin ids entrantes no consulta nada.
 */
export async function assertRoomTypesBelongToResidence(
  admin: SupabaseClient,
  residenceId: string,
  roomTypes: { id?: string }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const incomingIds = roomTypes.map((rt) => rt.id).filter((id): id is string => !!id);
  if (incomingIds.length === 0) return { ok: true };
  const { data, error } = await admin.from("room_types").select("id").eq("residence_id", residenceId).in("id", incomingIds);
  if (error) {
    console.error("[profile-edits] room types ownership read failed:", error);
    return { ok: false, error: "No pudimos verificar los tipos de habitación. Intentá de nuevo en unos minutos." };
  }
  const own = (data ?? []).map((r) => r.id as string);
  return findForeignRoomTypeIds(own, roomTypes).length > 0 ? { ok: false, error: ROOM_TYPE_NOT_OWNED_MESSAGE } : { ok: true };
}

interface ExistingRoomTypeRow {
  id: string;
  name: string;
  is_active: boolean;
  capacity_per_room: number | null;
}

/**
 * DR11: ¿este guardado cambia la ESTRUCTURA de habitaciones y camas? Es lo que exige además `operations.rooms_availability` (no alcanza con
 * `profile.edit`): agregar un tipo, quitar uno, reactivar uno desactivado, cambiar su nombre (es su identidad), la cantidad de habitaciones
 * activas o las plazas por habitación. Género, baño, características y tarifa NO son estructura de habitaciones (son datos del perfil).
 */
export function changesRoomStructure(
  existing: ExistingRoomTypeRow[],
  activeRoomCountByType: Map<string, number>,
  incoming: RoomTypeEditInput[],
): boolean {
  const byId = new Map(existing.map((t) => [t.id, t]));
  const incomingIds = new Set(incoming.map((rt) => rt.id).filter(Boolean) as string[]);
  if (existing.some((t) => t.is_active && !incomingIds.has(t.id))) return true;
  for (const rt of incoming) {
    if (!rt.id) return true;
    const current = byId.get(rt.id);
    if (!current || !current.is_active) return true;
    if (current.name !== rt.name) return true;
    if ((activeRoomCountByType.get(rt.id) ?? 0) !== rt.roomCount) return true;
    if ((current.capacity_per_room ?? 1) !== rt.capacityPerRoom) return true;
  }
  return false;
}

/**
 * Reemplaza cualquier edición previa del mismo `field_group` que
 * siguiera pendiente (se supera por la nueva) y crea la fila nueva.
 */
export async function stageProfileEdit(
  admin: SupabaseClient,
  params: {
    residenceId: string;
    fieldGroup: ProfileEditFieldGroup;
    oldValue: unknown;
    newValue: unknown;
    submittedByUserId: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: supersedeError } = await admin
    .from("residence_profile_edits")
    .update({ status: "cancelled_by_residence" })
    .eq("residence_id", params.residenceId)
    .eq("field_group", params.fieldGroup)
    .eq("status", "pending_admin_review");
  if (supersedeError) {
    console.error("[profile-edits] supersede failed:", supersedeError);
    return { ok: false, error: "No pudimos guardar el cambio pendiente de revisión." };
  }

  const { error } = await admin.from("residence_profile_edits").insert({
    residence_id: params.residenceId,
    field_group: params.fieldGroup,
    old_value: params.oldValue,
    new_value: params.newValue,
    status: "pending_admin_review",
    submitted_by: params.submittedByUserId,
  });
  if (error) {
    console.error("[profile-edits] insert failed:", error);
    return { ok: false, error: "No pudimos guardar el cambio pendiente de revisión." };
  }
  return { ok: true };
}

/**
 * Upsert de tipos de habitación + sync de rooms/beds — extraída de
 * `saveResidenceProfile` (Ciclo 34sexvicies) para que tanto el guardado
 * directo (residencia no verificada aún) como la aprobación admin de una
 * edición pendiente (residencia verificada) compartan la misma lógica.
 */
export async function applyRoomTypesUpdate(
  admin: SupabaseClient,
  params: { residenceId: string; sessionUserId: string; roomTypes: RoomTypeEditInput[]; arsPerUsd: number },
): Promise<{ ok: true; warnings: string[] } | { ok: false; error: string }> {
  const { residenceId, sessionUserId, roomTypes, arsPerUsd } = params;
  const warnings: string[] = [];

  const { data: existingTypes, error: existingError } = await admin
    .from("room_types")
    .select("id, is_active, monthly_price_usd, gender_policy, capacity_per_room")
    .eq("residence_id", residenceId);
  if (existingError) {
    console.error("[profile-edits] room types read failed:", existingError);
    return { ok: false, error: "No pudimos leer los tipos de habitación actuales." };
  }
  // IDOR: ningún id entrante puede ser de otra residencia. Se valida contra los tipos de ESTA residencia ANTES de escribir nada.
  if (findForeignRoomTypeIds((existingTypes ?? []).map((t) => t.id as string), roomTypes).length > 0) {
    return { ok: false, error: ROOM_TYPE_NOT_OWNED_MESSAGE };
  }
  const priceById = new Map((existingTypes ?? []).map((t) => [t.id, Number(t.monthly_price_usd)]));
  const draftIds = new Set(roomTypes.map((rt) => rt.id).filter(Boolean));
  const removed = (existingTypes ?? []).filter((t) => t.is_active && !draftIds.has(t.id));
  if (removed.length > 0) {
    const { error } = await admin
      .from("room_types")
      .update({ is_active: false })
      .in("id", removed.map((t) => t.id))
      .eq("residence_id", residenceId);
    if (error) return { ok: false, error: "No pudimos desactivar tipos de habitación quitados." };
    for (const t of removed) {
      const sync = await syncRoomsAndBeds(admin, { residenceId, roomTypeId: t.id, desiredRoomCount: 0, capacityPerRoom: 1 });
      if (sync.ok) warnings.push(...sync.warnings);
    }
  }

  for (const rt of roomTypes) {
    const monthlyPriceUsd = roundUsd(rt.monthlyPriceUsd);
    const baseFields = {
      name: rt.name,
      gender_policy: rt.genderPolicy || null,
      bathroom_type: rt.bathroomType || null,
      features: rt.features,
      capacity_per_room: rt.capacityPerRoom,
      monthly_price_usd: monthlyPriceUsd,
      monthly_price_ars: roundArs(usdToArs(monthlyPriceUsd, arsPerUsd)),
      is_active: true,
    };

    let roomTypeId = rt.id ?? null;
    if (roomTypeId) {
      // Filtrado también por residencia y con chequeo de filas: nunca toca un tipo que no sea de esta residencia.
      const { data: updatedRows, error } = await admin
        .from("room_types")
        .update(baseFields)
        .eq("id", roomTypeId)
        .eq("residence_id", residenceId)
        .select("id");
      if (error || !updatedRows || updatedRows.length === 0) return { ok: false, error: "No pudimos actualizar un tipo de habitación." };
      // Género por habitación (0057): las habitaciones que seguían heredando el género del tipo lo acompañan;
      // las que el dueño editó una por una (valor distinto del heredado) no se tocan.
      const before = (existingTypes ?? []).find((t) => t.id === roomTypeId);
      const genderChange = before
        ? inheritedGenderChange(
            { policy: before.gender_policy, capacity: before.capacity_per_room },
            { policy: rt.genderPolicy || null, capacity: rt.capacityPerRoom },
          )
        : null;
      if (genderChange) {
        const { error: genderError } = await admin
          .from("rooms")
          .update({ gender: genderChange.to })
          .eq("room_type_id", roomTypeId)
          .eq("residence_id", residenceId)
          .eq("gender", genderChange.from);
        // Sin la migración 0057 la columna no existe: se ignora, la ficha degrada al género del tipo.
        if (genderError) console.warn("[profile-edits] no se pudo propagar el género a las habitaciones:", genderError.message);
      }
      const oldPrice = priceById.get(roomTypeId) ?? null;
      await logTariffChange(admin, {
        residenceId,
        roomTypeId,
        changedByUserId: sessionUserId,
        fieldName: "monthly_price",
        oldValue: oldPrice,
        newValue: monthlyPriceUsd,
        currencyCode: "USD",
      });
    } else {
      const { data: inserted, error } = await admin
        .from("room_types")
        .insert({ residence_id: residenceId, ...baseFields })
        .select("id")
        .single();
      if (error || !inserted) return { ok: false, error: "No pudimos crear un tipo de habitación." };
      roomTypeId = inserted.id;
      await admin.from("profile_availability").insert({
        residence_id: residenceId,
        room_type_id: roomTypeId,
        status: "not_updated",
        available_count: null,
        last_confirmed_by: sessionUserId,
      });
    }

    const sync = await syncRoomsAndBeds(admin, {
      residenceId,
      roomTypeId: roomTypeId as string,
      desiredRoomCount: rt.roomCount,
      capacityPerRoom: rt.capacityPerRoom,
    });
    if (!sync.ok) return { ok: false, error: sync.error };
    warnings.push(...sync.warnings);
  }

  return { ok: true, warnings };
}

type PendingEdit = {
  id: string;
  residence_id: string;
  field_group: string;
  new_value: unknown;
};

/**
 * Aplica una edición aprobada a la tabla en vivo correspondiente. Se
 * llama desde la acción admin de aprobación (`/admin/profile-edits`).
 */
export async function applyApprovedEdit(
  admin: SupabaseClient,
  edit: PendingEdit,
  reviewerUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const newValue = edit.new_value as Record<string, unknown>;

  switch (edit.field_group) {
    case "photos": {
      const fileIds = (newValue.fileIds as string[]) ?? [];
      if (fileIds.length === 0) return { ok: true };
      const { error } = await admin.from("files").update({ status: "approved" }).in("id", fileIds);
      if (error) return { ok: false, error: "No pudimos aprobar las fotos." };
      return { ok: true };
    }
    case "services": {
      const { error } = await admin
        .from("residence_profile_sections")
        .upsert(
          { residence_id: edit.residence_id, section_type: "services", content: { items: newValue.items ?? [] } },
          { onConflict: "residence_id,section_type" },
        );
      if (error) return { ok: false, error: "No pudimos aprobar los servicios." };
      return { ok: true };
    }
    case "rules": {
      const { error } = await admin.from("residence_profile_sections").upsert(
        {
          residence_id: edit.residence_id,
          section_type: "rules",
          content: { summary: newValue.summary ?? "" },
          requires_admin_review: true,
        },
        { onConflict: "residence_id,section_type" },
      );
      if (error) return { ok: false, error: "No pudimos aprobar las reglas." };
      const rulesFile = newValue.rulesFile as { fileId: string } | null;
      if (rulesFile?.fileId) {
        const { error: fileError } = await admin.from("files").update({ status: "approved" }).eq("id", rulesFile.fileId);
        if (fileError) return { ok: false, error: "No pudimos aprobar el reglamento." };
      }
      return { ok: true };
    }
    case "minimum_stay_months": {
      const { error } = await admin
        .from("residences")
        .update({ minimum_stay_months: newValue.months ?? null })
        .eq("id", edit.residence_id);
      if (error) return { ok: false, error: "No pudimos aprobar el mínimo de estadía." };
      return { ok: true };
    }
    case "room_types": {
      const { data: residence } = await admin.from("residences").select("id").eq("id", edit.residence_id).single();
      if (!residence) return { ok: false, error: "La residencia ya no existe." };
      const rate = await getCurrentExchangeRate();
      const result = await applyRoomTypesUpdate(admin, {
        residenceId: edit.residence_id,
        sessionUserId: reviewerUserId,
        roomTypes: (newValue.roomTypes as RoomTypeEditInput[]) ?? [],
        arsPerUsd: rate.arsPerUsd,
      });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true };
    }
    default:
      return { ok: false, error: `Tipo de edición desconocido: ${edit.field_group}` };
  }
}

/**
 * Al rechazar una edición de fotos/reglamento, las marca `rejected` en
 * `files` para que dejen de contar como "pendientes" en la galería del
 * dueño (nunca llegaron a mostrarse públicamente — `status` nunca fue
 * `approved`).
 */
export async function discardRejectedFiles(admin: SupabaseClient, edit: PendingEdit): Promise<void> {
  const newValue = edit.new_value as Record<string, unknown>;
  const fileIds: string[] = [];
  if (edit.field_group === "photos") fileIds.push(...((newValue.fileIds as string[]) ?? []));
  if (edit.field_group === "rules") {
    const rulesFile = newValue.rulesFile as { fileId: string } | null;
    if (rulesFile?.fileId) fileIds.push(rulesFile.fileId);
  }
  if (fileIds.length === 0) return;
  const { error } = await admin.from("files").update({ status: "rejected" }).in("id", fileIds);
  if (error) console.error("[profile-edits] discard rejected files failed:", error);
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { pickActivePromotion, todayIso, type PromotionRow } from "@/lib/applications/reservationMoney";

/**
 * Promociones de tarifa de una residencia (DR18 t3, migración 0060). Lectura solo desde el servidor (RLS sin policies).
 * Sin la migración (o ante un error) devuelve `schemaReady: false` y lista vacía: nada se descuenta y la ficha queda como antes.
 */
export async function loadResidencePromotions(
  admin: SupabaseClient,
  residenceId: string,
): Promise<{ promotions: PromotionRow[]; schemaReady: boolean; failed: boolean }> {
  const { data, error } = await admin
    .from("residence_promotions")
    .select("id, label, discount_percent, room_type_id, starts_on, ends_on, is_active")
    .eq("residence_id", residenceId);
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[promotions] lectura fallida:", error.code, error.message);
    return { promotions: [], schemaReady: false, failed: !isMissingSchemaError(error) };
  }
  const promotions = (data ?? []).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    discountPercent: Number(r.discount_percent),
    roomTypeId: (r.room_type_id as string | null) ?? null,
    startsOn: r.starts_on as string,
    endsOn: (r.ends_on as string | null) ?? null,
    isActive: r.is_active === true,
  }));
  promotions.sort((a, b) => (a.startsOn < b.startsOn ? 1 : a.startsOn > b.startsOn ? -1 : 0));
  return { promotions, schemaReady: true, failed: false };
}

/**
 * Promoción vigente hoy para un tipo (la de mayor porcentaje), o null. Si la lectura falla por algo distinto a «migración sin aplicar»
 * devuelve `{ error }`: quien arma un snapshot no debe congelar a precio de lista sin saber si había una promoción.
 */
export async function getActivePromotionForType(
  admin: SupabaseClient,
  residenceId: string,
  roomTypeId: string,
  today: string = todayIso(),
): Promise<{ promotion: PromotionRow | null } | { error: string }> {
  const { promotions, failed } = await loadResidencePromotions(admin, residenceId);
  if (failed) return { error: "No pudimos leer las promociones vigentes de la residencia. Intentá de nuevo en unos minutos." };
  return { promotion: pickActivePromotion(promotions, roomTypeId, today) };
}

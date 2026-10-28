"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidencePermission } from "@/lib/residences/access";
import { createAuditLog } from "@/lib/audit";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { parsePromotionInput, todayIso } from "@/lib/applications/reservationMoney";

export type CreatedPromotion = { id: string; label: string; discountPercent: number; roomTypeId: string | null; startsOn: string; endsOn: string | null };
export type PromotionActionState = { status: "idle" | "success" | "error"; message?: string; promotion?: CreatedPromotion };

const MAX_ACTIVE_PROMOTIONS = 10;

/**
 * Crea una promoción de tarifa (DR18 t3, migración 0060): descuento % sobre la renta, con vigencia, para toda la residencia o un tipo.
 * No toca las tarifas de lista ni las solicitudes ya creadas. Requiere `profile.edit`; el tipo se valida contra ESTA residencia.
 */
export async function createPromotion(
  residenceId: string,
  input: { label: string; discountPercent: number | string; roomTypeId: string | null; startsOn: string; endsOn: string },
): Promise<PromotionActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };
  const access = await assertResidencePermission(admin, sessionUser.id, residenceId, "profile.edit");
  if (!access.ok) return { status: "error", message: access.error };

  const parsed = parsePromotionInput(input, todayIso());
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const promo = parsed.value;

  if (promo.roomTypeId) {
    const { data: type } = await admin
      .from("room_types")
      .select("id")
      .eq("id", promo.roomTypeId)
      .eq("residence_id", residenceId)
      .eq("is_active", true)
      .maybeSingle();
    if (!type) return { status: "error", message: "El tipo de habitación elegido no es válido." };
  }

  const { count, error: countError } = await admin
    .from("residence_promotions")
    .select("id", { count: "exact", head: true })
    .eq("residence_id", residenceId)
    .eq("is_active", true);
  if (countError) {
    if (isMissingSchemaError(countError)) return { status: "error", message: "Las promociones todavía no están disponibles. Probá de nuevo en unos días." };
    return { status: "error", message: "No pudimos crear la promoción. Probá de nuevo en unos minutos." };
  }
  if ((count ?? 0) >= MAX_ACTIVE_PROMOTIONS)
    return { status: "error", message: `Ya tenés ${MAX_ACTIVE_PROMOTIONS} promociones activas. Finalizá alguna antes de crear otra.` };

  const { data: created, error } = await admin
    .from("residence_promotions")
    .insert({
      residence_id: residenceId,
      room_type_id: promo.roomTypeId,
      label: promo.label,
      discount_percent: promo.discountPercent,
      starts_on: promo.startsOn,
      ends_on: promo.endsOn,
      created_by_user_id: sessionUser.id,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[promotions] create failed:", error);
    return { status: "error", message: "No pudimos crear la promoción. Probá de nuevo en unos minutos." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: access.actorRole,
    action: "residence_promotion_created",
    entityType: "residence_promotions",
    entityId: created.id as string,
    newValue: { residence_id: residenceId, ...promo },
  });
  revalidatePath(`/residence/${residenceId}/profile`);
  return {
    status: "success",
    message: "Promoción creada. Ya se ve en tu ficha.",
    promotion: { id: created.id as string, label: promo.label, discountPercent: promo.discountPercent, roomTypeId: promo.roomTypeId, startsOn: promo.startsOn, endsOn: promo.endsOn },
  };
}

/** Finaliza una promoción (la deja inactiva; no se borra, para conservar el historial de lo que se congeló en solicitudes). */
export async function endPromotion(residenceId: string, promotionId: string): Promise<PromotionActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };
  if (!/^[0-9a-f-]{36}$/i.test(promotionId)) return { status: "error", message: "No encontramos esa promoción." };
  const access = await assertResidencePermission(admin, sessionUser.id, residenceId, "profile.edit");
  if (!access.ok) return { status: "error", message: access.error };

  const { data: updated, error } = await admin
    .from("residence_promotions")
    .update({ is_active: false })
    .eq("id", promotionId)
    .eq("residence_id", residenceId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[promotions] end failed:", error);
    return { status: "error", message: "No pudimos finalizar la promoción. Probá de nuevo en unos minutos." };
  }
  if (!updated) return { status: "error", message: "La promoción ya estaba finalizada o no existe." };

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: access.actorRole,
    action: "residence_promotion_ended",
    entityType: "residence_promotions",
    entityId: promotionId,
    newValue: { residence_id: residenceId },
  });
  revalidatePath(`/residence/${residenceId}/profile`);
  return { status: "success", message: "Promoción finalizada." };
}

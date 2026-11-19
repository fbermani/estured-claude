import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { usdToArsRounded } from "@/lib/mock/exchange";
import { startingPriceUsd, typeAvailabilityState } from "@/lib/availability/typeAvailability";
import { applyPromotion, pickActivePromotion, todayIso } from "@/lib/applications/reservationMoney";
import { loadResidencePromotions } from "@/lib/residences/promotions";
import { buildGalleryPhotos, loadPhotoMeta } from "@/lib/residences/photoMetaDb";
import { pickRotationPhotos } from "@/lib/residences/photoMeta";

export type SharePreview = {
  name: string;
  zone: string | null;
  /** Portada: la foto principal que eligió la residencia o, sin elegir, la primera de las destacadas (en el orden elegido). */
  coverUrl: string | null;
  /** «Desde» con el mismo criterio de la ficha (mínimo de los tipos que se pueden pedir, con promoción aplicada). */
  fromPriceUsd: number | null;
  /** Referencia en pesos de ese «desde» (siempre acompaña al monto en USD). */
  fromPriceArs: number | null;
};

/**
 * Lo mínimo que necesita la imagen de vista previa del link (`opengraph-image.tsx`): nombre, barrio, portada y «desde».
 * Solo residencias publicadas (`verified_active`); devuelve `null` si no existe o no hay conexión con Supabase.
 */
export async function loadSharePreview(slug: string): Promise<SharePreview | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data: residence } = await admin
    .from("residences")
    .select("id, name, public_area")
    .eq("slug", slug)
    .eq("status", "verified_active")
    .maybeSingle();
  if (!residence) return null;

  const [roomTypesRes, photosRes, photoMeta, promotionsRes, rate] = await Promise.all([
    admin
      .from("room_types")
      .select("id, name, monthly_price_usd, profile_availability(status)")
      .eq("residence_id", residence.id)
      .eq("is_active", true),
    admin
      .from("files")
      .select("id, storage_path")
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residence.id)
      .eq("document_type", "residence_photo")
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
    loadPhotoMeta(admin, [residence.id]),
    loadResidencePromotions(admin, residence.id),
    getCurrentExchangeRate(),
  ]);

  const roomTypes = roomTypesRes.data ?? [];
  const photos = buildGalleryPhotos(
    (photosRes.data ?? []) as { id: string; storage_path: string }[],
    photoMeta.byFileId,
    (path) => admin.storage.from("public-residence-media").getPublicUrl(path).data.publicUrl,
    new Map(roomTypes.map((rt) => [rt.id as string, rt.name as string])),
  );
  const cover = pickRotationPhotos(photos)[0]?.url ?? null;

  const today = todayIso();
  const fromPriceUsd = startingPriceUsd(
    roomTypes.map((rt) => ({
      priceUsd: applyPromotion(Number(rt.monthly_price_usd), pickActivePromotion(promotionsRes.promotions, rt.id as string, today)?.discountPercent),
      state: typeAvailabilityState((rt.profile_availability as unknown as { status: string } | null)?.status),
    })),
  );

  return {
    name: residence.name as string,
    zone: ((residence.public_area as string | null) ?? "").trim() || null,
    coverUrl: cover,
    fromPriceUsd,
    fromPriceArs: fromPriceUsd != null ? usdToArsRounded(fromPriceUsd, rate.arsPerUsd) : null,
  };
}

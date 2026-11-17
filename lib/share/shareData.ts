import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { applyPromotion, normalizeDepositMode, pickActivePromotion, todayIso } from "@/lib/applications/reservationMoney";
import { loadResidencePromotions } from "@/lib/residences/promotions";
import { startingPriceUsd, typeAvailabilityState } from "@/lib/availability/typeAvailability";
import { findUniversitiesByName, haversineDistanceKm, withoutOtherUniversity } from "@/lib/data/buenosAiresUniversities";
import { getResidenceLocation } from "@/lib/residences/residenceLocation";
import { getShareBaseUrl } from "@/lib/share/shareLink";
import { buildShareLink, buildShareValues, buildWhatsappMessageLink, type SharePlaceholderKey } from "@/lib/share/resolveShareMessage";

export type ShareData = {
  residenceName: string;
  slug: string;
  link: string;
  /** `true` si la ficha está publicada (el link abre y la imagen de vista previa existe). */
  published: boolean;
  /** Valor de cada placeholder (`null` = falta el dato: esa línea se omite). */
  values: Record<SharePlaceholderKey, string | null>;
};

/**
 * Datos reales de la residencia para resolver el mensaje: precio «desde» (mismo criterio de la ficha, con promoción) y su referencia en
 * ARS con la cotización vigente, barrio, universidad más cercana y condiciones de estadía. Funciona también para residencias todavía no
 * publicadas (el panel las ve igual), pero ahí el link no abre hasta que se publiquen.
 */
export async function loadShareData(admin: SupabaseClient, residenceId: string): Promise<ShareData | null> {
  const { data: residence, error } = await admin
    .from("residences")
    .select(
      "id, name, slug, status, public_area, latitude, longitude, minimum_stay_months, enrollment_fee_mode, enrollment_fee_usd, deposit_usd, deposit_mode",
    )
    .eq("id", residenceId)
    .maybeSingle();
  if (error || !residence) {
    if (error) console.error("[share] no se pudo leer la residencia:", error.code, error.message);
    return null;
  }

  const [typesRes, nearRes, promotions, rate] = await Promise.all([
    admin.from("room_types").select("id, monthly_price_usd, profile_availability(status)").eq("residence_id", residenceId).eq("is_active", true),
    admin.from("residence_profile_sections").select("content").eq("residence_id", residenceId).eq("section_type", "near_universities").maybeSingle(),
    loadResidencePromotions(admin, residenceId),
    getCurrentExchangeRate(),
  ]);

  const today = todayIso();
  const fromPriceUsd = startingPriceUsd(
    (typesRes.data ?? []).map((rt) => ({
      priceUsd: applyPromotion(Number(rt.monthly_price_usd), pickActivePromotion(promotions.promotions, rt.id as string, today)?.discountPercent),
      state: typeAvailabilityState((rt.profile_availability as unknown as { status: string } | null)?.status),
    })),
  );

  const nearNames = withoutOtherUniversity(
    Array.isArray((nearRes.data?.content as { items?: unknown } | null)?.items)
      ? ((nearRes.data?.content as { items: unknown[] }).items.filter((x): x is string => typeof x === "string"))
      : [],
  );
  const location = getResidenceLocation(residence);
  const nearest = findUniversitiesByName(nearNames)
    .map((u) => ({ name: u.name, km: haversineDistanceKm(location, u) }))
    .sort((a, b) => a.km - b.km)[0];

  const slug = residence.slug as string;
  const link = buildShareLink(getShareBaseUrl(), slug);
  return {
    residenceName: residence.name as string,
    slug,
    // «Copiar link» entrega el link limpio; el que va dentro del mensaje de WhatsApp lleva `?ref=wa` (la ficha lo ignora).
    link,
    published: residence.status === "verified_active",
    values: buildShareValues({
      link: buildWhatsappMessageLink(getShareBaseUrl(), slug),
      fromPriceUsd,
      arsPerUsd: rate.arsPerUsd,
      zone: (residence.public_area as string | null) ?? null,
      nearestUniversityName: nearest?.name ?? null,
      minimumStayMonths: residence.minimum_stay_months != null ? Number(residence.minimum_stay_months) : null,
      enrollmentFeeMode: (residence.enrollment_fee_mode as "one_month" | "manual" | null) ?? null,
      enrollmentFeeUsd: residence.enrollment_fee_usd != null ? Number(residence.enrollment_fee_usd) : null,
      depositUsd: residence.deposit_usd != null ? Number(residence.deposit_usd) : null,
      depositMode: normalizeDepositMode(residence.deposit_mode),
    }),
  };
}

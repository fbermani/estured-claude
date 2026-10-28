import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { residenceAcceptsAge } from "@/lib/residences/age";
import { isMissingColumnError } from "@/lib/residences/changesRequest";
import { cardPriceFrom } from "@/lib/residences/cardPromotion";
import { loadPromotionsByResidence } from "@/lib/residences/promotions";
import { todayIso } from "@/lib/applications/reservationMoney";
import { getApprovedCustomAmenitiesByResidence } from "@/lib/residences/customAmenitiesDb";
import { buildGalleryPhotos, loadPhotoMeta, rotationUrls } from "@/lib/residences/photoMetaDb";
import { computeCapacity, residentsToDisplay } from "@/lib/residences/occupancy";
import type { Residence, RoomTypeName } from "@/types/domain";
import {
  residenceAvailabilityMode,
  catalogAvailabilityHint,
  typeAvailabilityState,
} from "@/lib/availability/typeAvailability";

const CANONICAL_ROOM_TYPES: readonly string[] = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];

/**
 * Catálogo real de residencias verificadas, para `/search` y la home.
 * Reemplaza `lib/mock/residences.ts` (Ciclo 34undevicies) ahora que
 * existen residencias `verified_active` de verdad — antes de esto el
 * buscador principal del sitio mostraba datos inventados.
 */
export async function getCatalogResidences(options: { studentAge?: number | null } = {}): Promise<Residence[]> {
  return (await getCatalogResidencesWithTotal(options)).residences;
}

/** Igual que `getCatalogResidences`, pero además devuelve el total publicado antes del filtro por edad (una sola consulta). */
export async function getCatalogResidencesWithTotal(
  options: { studentAge?: number | null } = {},
): Promise<{ residences: Residence[]; total: number }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { residences: [], total: 0 };

  // DR14 (migración 0052): las columnas de edad pueden no existir todavía; en ese caso se reintenta sin ellas (sin filtro por edad).
  type CatalogRow = { id: string; slug: string; name: string; public_area: string | null; description: string | null; min_resident_age?: number | null; max_resident_age?: number | null; accepts_minors?: boolean | null };
  let residences: CatalogRow[] | null = null;
  const withAge = await admin
    .from("residences")
    .select("id, slug, name, public_area, description, min_resident_age, max_resident_age, accepts_minors")
    .eq("status", "verified_active")
    .order("created_at", { ascending: false });
  if (!withAge.error) {
    residences = withAge.data as CatalogRow[];
  } else if (!isMissingColumnError(withAge.error)) {
    console.error("[catalog] error al leer residencias:", withAge.error.message);
    return { residences: [], total: 0 };
  } else {
    const legacy = await admin
      .from("residences")
      .select("id, slug, name, public_area, description")
      .eq("status", "verified_active")
      .order("created_at", { ascending: false });
    if (legacy.error) {
      console.error("[catalog] error al leer residencias (sin columnas de edad):", legacy.error.message);
      return { residences: [], total: 0 };
    }
    residences = legacy.data as CatalogRow[] | null;
  }
  const total = residences?.length ?? 0;
  if (residences && options.studentAge != null) {
    const age = options.studentAge;
    residences = residences.filter((r) =>
      residenceAcceptsAge({ minResidentAge: r.min_resident_age, maxResidentAge: r.max_resident_age, acceptsMinors: r.accepts_minors }, age),
    );
  }
  if (!residences || residences.length === 0) return { residences: [], total };

  const ids = residences.map((r) => r.id);

  const [{ data: roomTypes }, { data: sections }, { data: photos }, { data: stays }, { data: rooms }, accessRes, photoMeta, customByResidence, promotionsByResidence] = await Promise.all([
    admin
      .from("room_types")
      .select("id, residence_id, name, monthly_price_usd, capacity_per_room, profile_availability(status, available_count)")
      .in("residence_id", ids)
      .eq("is_active", true),
    admin.from("residence_profile_sections").select("residence_id, section_type, content").in("residence_id", ids),
    admin
      .from("files")
      .select("id, related_entity_id, storage_path")
      .eq("related_entity_type", "residences")
      .in("related_entity_id", ids)
      .eq("document_type", "residence_photo")
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
    admin
      .from("resident_stays")
      .select("residence_id")
      .in("residence_id", ids)
      .eq("is_current", true)
      .neq("status", "hidden_by_user")
      .neq("status", "inactive"),
    // DR18 (tanda 2): capacidad declarada = habitaciones activas × plazas por habitación.
    // Ojo: PostgREST corta en 1000 filas por defecto; alcanza para el catálogo actual (habitaciones activas de todas las residencias publicadas).
    admin.from("rooms").select("residence_id, room_type_id").in("residence_id", ids).eq("is_active", true).limit(1000),
    // Los residentes solo se muestran con Gestión Operativa (Premium); si no se puede leer el plan, no se muestran (fail-closed).
    admin.from("residences").select("id, has_operational_management_access").in("id", ids),
    loadPhotoMeta(admin, ids),
    // DR18 t4: ítems «Otro» aprobados (pendientes y rechazados nunca llegan acá).
    getApprovedCustomAmenitiesByResidence(admin, ids),
    // DR18 t4: promociones vigentes por tipo para el «antes/ahora» de la tarjeta (sin la 0060 queda la tarifa de lista).
    loadPromotionsByResidence(admin, ids),
  ]);
  if (accessRes.error) console.error("[catalog] no se pudo leer el plan de las residencias:", accessRes.error.message);
  const premiumById = new Map((accessRes.error ? [] : (accessRes.data ?? [])).map((a) => [a.id as string, a.has_operational_management_access as boolean | null]));

  const residentsCountById = new Map<string, number>();
  for (const stay of stays ?? []) {
    residentsCountById.set(stay.residence_id, (residentsCountById.get(stay.residence_id) ?? 0) + 1);
  }

  const result = residences.map((r): Residence => {
    const rts = (roomTypes ?? [])
      .filter((rt) => rt.residence_id === r.id)
      .map((rt) => ({
        ...rt,
        profile_availability: rt.profile_availability as unknown as { status: string; available_count: number | null } | null,
      }));

    // DR18 (tanda 2): la tarjeta rota las fotos destacadas (o las primeras 5); la portada es la primera de ellas.
    const typeNames = new Map(rts.map((rt) => [rt.id as string, rt.name as string]));
    const photoUrls = rotationUrls(
      buildGalleryPhotos(
        (photos ?? []).filter((p) => p.related_entity_id === r.id).map((p) => ({ id: p.id as string, storage_path: p.storage_path as string })),
        photoMeta.byFileId,
        (path) => admin.storage.from("public-residence-media").getPublicUrl(path).data.publicUrl,
        typeNames,
      ),
    );
    const capacityPlaces = computeCapacity(
      rts.map((rt) => ({ id: rt.id as string, capacity_per_room: rt.capacity_per_room as number | null })),
      (rooms ?? []).filter((rm) => rm.residence_id === r.id).map((rm) => ({ room_type_id: rm.room_type_id as string })),
    );
    const residentsRaw = residentsCountById.get(r.id) ?? 0;
    const residentsVisible = residentsToDisplay(premiumById.get(r.id), residentsRaw) ?? 0;

    const sectionMap = Object.fromEntries(
      (sections ?? []).filter((s) => s.residence_id === r.id).map((s) => [s.section_type, s.content]),
    );
    const custom = customByResidence.get(r.id);
    const services = [...new Set([...((sectionMap.services?.items as string[]) ?? []), ...(custom?.services ?? [])])];
    const commonAreas = [...new Set([...((sectionMap.common_areas?.items as string[]) ?? []), ...(custom?.areas ?? [])])];
    const nearUniversities = (sectionMap.near_universities?.items as string[]) ?? [];

    // D3/H03: la disponibilidad la manda el tipo de habitación (`profile_availability`),
    // siempre vía el helper único. El precio "desde" excluye los tipos completos.
    const typeStates = rts.map((rt) => typeAvailabilityState(rt.profile_availability?.status));
    const cardPrice = cardPriceFrom(
      rts.map((rt, i) => ({ id: rt.id as string, listUsd: Number(rt.monthly_price_usd), state: typeStates[i] })),
      promotionsByResidence.get(r.id) ?? [],
      todayIso(),
    );
    const priceFromUsd = cardPrice.fromUsd ?? 0;
    const availabilityMode = residenceAvailabilityMode(typeStates);

    const roomTypeOffers = rts
      .filter((rt) => CANONICAL_ROOM_TYPES.includes(rt.name))
      .map((rt) => ({
        type: rt.name as RoomTypeName,
        priceUsd: Number(rt.monthly_price_usd),
        available: typeAvailabilityState(rt.profile_availability?.status) === "available",
      }));

    return {
      slug: r.slug,
      name: r.name,
      zone: r.public_area ?? "CABA",
      city: "CABA",
      mode: "perfil_verificado",
      verificationStatus: "verified_active",
      availabilityMode,
      published: true,
      priceFromUsd,
      ...(cardPrice.listFromUsd != null && cardPrice.promotionPercent != null
        ? { priceFromListUsd: cardPrice.listFromUsd, promotionPercent: cardPrice.promotionPercent }
        : {}),
      matriculaUsd: null,
      depositoUsd: null,
      roomTypes: roomTypeOffers,
      services,
      commonAreas,
      highlightedRules: [],
      ...(r.min_resident_age != null
        ? { minResidentAge: r.min_resident_age, maxResidentAge: r.max_resident_age ?? null, acceptsMinors: r.accepts_minors === true }
        : {}),
      nearUniversities,
      idealFor: "",
      description: r.description ?? "",
      photos: photoUrls,
      hasWaitlist: availabilityMode === "full",
      availabilityHint: catalogAvailabilityHint(typeStates),
      residentsCount: residentsVisible,
      capacityPlaces: capacityPlaces > 0 ? capacityPlaces : undefined,
    };
  });
  return { residences: result, total };
}

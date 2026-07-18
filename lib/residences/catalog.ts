import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AvailabilityMode, Residence, RoomTypeName } from "@/types/domain";

const CANONICAL_ROOM_TYPES: readonly string[] = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];

/**
 * Catálogo real de residencias verificadas, para `/search` y la home.
 * Reemplaza `lib/mock/residences.ts` (Ciclo 34undevicies) ahora que
 * existen residencias `verified_active` de verdad — antes de esto el
 * buscador principal del sitio mostraba datos inventados.
 */
export async function getCatalogResidences(): Promise<Residence[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const { data: residences } = await admin
    .from("residences")
    .select("id, slug, name, public_area, description")
    .eq("status", "verified_active")
    .order("created_at", { ascending: false });
  if (!residences || residences.length === 0) return [];

  const ids = residences.map((r) => r.id);

  const [{ data: roomTypes }, { data: sections }, { data: photos }, { data: stays }] = await Promise.all([
    admin
      .from("room_types")
      .select("residence_id, name, monthly_price_usd, profile_availability(status, available_count)")
      .in("residence_id", ids)
      .eq("is_active", true),
    admin.from("residence_profile_sections").select("residence_id, section_type, content").in("residence_id", ids),
    admin
      .from("files")
      .select("related_entity_id, storage_path")
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
  ]);

  const residentsCountById = new Map<string, number>();
  for (const stay of stays ?? []) {
    residentsCountById.set(stay.residence_id, (residentsCountById.get(stay.residence_id) ?? 0) + 1);
  }

  return residences.map((r): Residence => {
    const rts = (roomTypes ?? [])
      .filter((rt) => rt.residence_id === r.id)
      .map((rt) => ({
        ...rt,
        profile_availability: rt.profile_availability as unknown as { status: string; available_count: number | null } | null,
      }));

    const photoUrls = (photos ?? [])
      .filter((p) => p.related_entity_id === r.id)
      .map((p) => admin.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl);

    const sectionMap = Object.fromEntries(
      (sections ?? []).filter((s) => s.residence_id === r.id).map((s) => [s.section_type, s.content]),
    );
    const services = (sectionMap.services?.items as string[]) ?? [];
    const nearUniversities = (sectionMap.near_universities?.items as string[]) ?? [];

    const prices = rts.map((rt) => Number(rt.monthly_price_usd)).filter((p) => !Number.isNaN(p));
    const priceFromUsd = prices.length > 0 ? Math.min(...prices) : 0;

    const anyAvailable = rts.some((rt) => rt.profile_availability?.status === "available_to_confirm");
    const allFull = rts.length > 0 && rts.every((rt) => rt.profile_availability?.status === "full");
    const availabilityMode: AvailabilityMode = anyAvailable ? "by_room_type_to_confirm" : allFull ? "full" : "not_updated";

    const roomTypeOffers = rts
      .filter((rt) => CANONICAL_ROOM_TYPES.includes(rt.name))
      .map((rt) => ({
        type: rt.name as RoomTypeName,
        priceUsd: Number(rt.monthly_price_usd),
        available: rt.profile_availability?.status === "available_to_confirm",
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
      matriculaUsd: null,
      depositoUsd: null,
      roomTypes: roomTypeOffers,
      services,
      highlightedRules: [],
      nearUniversities,
      idealFor: "",
      description: r.description ?? "",
      photos: photoUrls,
      hasWaitlist: availabilityMode === "full",
      residentsCount: residentsCountById.get(r.id) ?? 0,
    };
  });
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodeAddress, type Geocoder } from "@/lib/geocoding/nominatim";
import { setResidenceLocationByAdmin } from "@/lib/residences/setResidenceLocationByAdmin";

export type GeocodeResidenceResult =
  | { status: "ok"; lat: number; lng: number }
  | { status: "not_found" }
  | { status: "error"; message: string };

/**
 * Identifica la coordenada de una residencia a partir de su dirección (DF6) y la guarda con auditoría.
 * Degrada con gracia: si el geocoder no encuentra o falla, no toca la coordenada actual.
 */
export async function geocodeResidenceByAdmin(
  admin: SupabaseClient,
  params: { residenceId: string; actorUserId: string; actorRole: string },
  geocoder: Geocoder = geocodeAddress,
): Promise<GeocodeResidenceResult> {
  const { data: residence, error } = await admin
    .from("residences")
    .select("id, address_line, public_area, city")
    .eq("id", params.residenceId)
    .maybeSingle();
  if (error) return { status: "error", message: "No pudimos leer la residencia." };
  if (!residence) return { status: "error", message: "Residencia no encontrada." };
  if (!residence.address_line?.trim()) return { status: "error", message: "La residencia no tiene dirección cargada." };

  const found = await geocoder({ addressLine: residence.address_line, zone: residence.public_area, city: residence.city });
  if (!found) return { status: "not_found" };

  const saved = await setResidenceLocationByAdmin(admin, { ...params, latitude: found.lat, longitude: found.lng });
  if (saved.status === "error") return { status: "error", message: saved.message };
  return { status: "ok", lat: saved.lat as number, lng: saved.lng as number };
}

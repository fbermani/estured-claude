import "server-only";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { RAIL_COLUMNS, buildRail, toRailCard, type RailCard } from "@/lib/preapertura/communityRail";

/**
 * Carrusel público REAL (DR44). Consulta con service role SOLO en el servidor y SOLO las columnas de `RAIL_COLUMNS`; lo que sale de acá
 * al navegador son `RailCard` ya saneadas (sin apellido, residencia actual ni ids). Filtros: rol estudiante, casillero de comunidad
 * tildado, nombre cargado y 18+ (`toRailCard` lo vuelve a exigir: los menores no pueden activar la comunidad, esto es defensa extra).
 */
export const COMMUNITY_RAIL_TAG = "preapertura-community";
const RAIL_LIMIT = 24;

export async function loadCommunityCards(admin: SupabaseClient, now: Date = new Date()): Promise<RailCard[]> {
  const { data, error } = await admin
    .from("preapertura_estudiantes")
    .select(RAIL_COLUMNS.join(", "))
    .eq("role", "student")
    .eq("consent_comunidad", true)
    .not("first_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(RAIL_LIMIT);
  if (error || !data) return [];
  const rows = data as unknown as Record<string, unknown>[];
  return rows.map((row, i) => toRailCard(row, i, now)).filter((c): c is RailCard => c !== null);
}

/**
 * Tira lista para dibujar. Con caché de 60 s y la etiqueta `preapertura-community`: al guardar el perfil se invalida (`revalidateTag`)
 * para que quien destilda el casillero desaparezca al instante. Sin base o con error: solo ejemplos rotulados.
 */
const cachedRail = unstable_cache(
  async () => {
    const admin = getSupabaseAdmin();
    if (!admin) return buildRail([]);
    try {
      return buildRail(await loadCommunityCards(admin));
    } catch {
      return buildRail([]);
    }
  },
  ["preapertura-community-rail"],
  { revalidate: 60, tags: [COMMUNITY_RAIL_TAG] },
);

export async function getCommunityRail() {
  return cachedRail();
}

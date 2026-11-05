"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";
import { computeCommunityStats, type CommunityStats } from "@/lib/residents/communityStats";
import { toPreviewData, type PreviewProfile, type PreviewSlot } from "@/lib/residents/communityPreview";

export type CommunityPreview =
  | {
      ok: true;
      total: number;
      stats: CommunityStats | null;
      profiles: PreviewProfile[];
      slots: PreviewSlot[];
      /** true si quien mira no tiene sesión: no recibe nacionalidad, edad ni carrera. */
      guest: boolean;
    }
  | { ok: false; message: string };

const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;

/**
 * Comunidad para el modal de la tarjeta de /search: los mismos datos y reglas de privacidad que la sección de comunidad
 * de la ficha (`getCommunityVisibility` + `computeCommunityStats` + `toPreviewData`). Se pide al abrir el modal, no en el
 * listado. Solo residencias publicadas (`verified_active`). El visitante recibe solo cuántos lugares hay por tipo.
 */
export async function loadCommunityPreview(slug: string): Promise<CommunityPreview> {
  const fail: CommunityPreview = { ok: false, message: "No pudimos cargar los datos de la comunidad. Probá de nuevo en un rato." };
  if (typeof slug !== "string" || !SLUG.test(slug)) return fail;
  const admin = getSupabaseAdmin();
  if (!admin) return fail;

  const { data: residence, error } = await admin.from("residences").select("id").eq("slug", slug).eq("status", "verified_active").maybeSingle();
  if (error || !residence) return fail;

  const sessionUser = await getSessionUser();
  const guest = !sessionUser;
  const community = await getCommunityVisibility(admin, residence.id as string, guest ? "guest" : "registered").catch(() => null);
  if (!community) return fail;
  const { profiles, slots } = toPreviewData(community.cards, guest);
  return { ok: true, total: community.totalResidents, stats: computeCommunityStats(community.cards), profiles, slots, guest };
}

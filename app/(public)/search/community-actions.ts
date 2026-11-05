"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { residentsToDisplay } from "@/lib/residences/occupancy";
import { loadAverageResidentAge } from "@/lib/residents/averageAge";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";
import { computeCommunityStats } from "@/lib/residents/communityStats";

export type CommunityPreview =
  | {
      ok: true;
      residents: number | null;
      averageAgeYears: number | null;
      countries: number | null;
      careers: number | null;
      /** true si quien mira no tiene sesión: no recibe países ni carreras. */
      guest: boolean;
    }
  | { ok: false; message: string };

const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;

/**
 * Resumen de comunidad para el modal de la tarjeta de /search. Se pide al abrir el modal (no en el listado) y reutiliza
 * las mismas reglas de privacidad de la ficha: residentes y edad promedio solo con Gestión Operativa (la edad, además,
 * con más de 10 edades), y países/carreras solo con 3 o más perfiles visibles para quien mira (el visitante sin sesión
 * no recibe datos individuales, así que esas cifras le dan `null`). Solo residencias publicadas (`verified_active`).
 */
export async function loadCommunityPreview(slug: string): Promise<CommunityPreview> {
  const fail: CommunityPreview = { ok: false, message: "No pudimos cargar los datos de la comunidad. Probá de nuevo en un rato." };
  if (typeof slug !== "string" || !SLUG.test(slug)) return fail;
  const admin = getSupabaseAdmin();
  if (!admin) return fail;

  const { data: residence, error } = await admin
    .from("residences")
    .select("id, has_operational_management_access")
    .eq("slug", slug)
    .eq("status", "verified_active")
    .maybeSingle();
  if (error || !residence) return fail;
  const premium = residence.has_operational_management_access as boolean | null;

  const sessionUser = await getSessionUser();
  const [staysRes, averageAge, community] = await Promise.all([
    admin.from("resident_stays").select("id", { count: "exact", head: true }).eq("residence_id", residence.id).eq("is_current", true).neq("status", "hidden_by_user").neq("status", "inactive"),
    loadAverageResidentAge(admin, residence.id as string, premium),
    getCommunityVisibility(admin, residence.id as string, sessionUser ? "registered" : "guest").catch(() => null),
  ]);
  const stats = community ? computeCommunityStats(community.cards) : null;
  return {
    ok: true,
    residents: residentsToDisplay(premium, staysRes.error ? 0 : (staysRes.count ?? 0)),
    averageAgeYears: averageAge?.years ?? null,
    countries: stats?.countries ?? null,
    careers: stats?.careers ?? null,
    guest: !sessionUser,
  };
}

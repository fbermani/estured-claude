import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/siteUrl";
import { getAllGuides } from "@/lib/guides/load";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // lastModified de las páginas estáticas = momento de la generación (el sitemap es dinámico); mejor dato que ninguno.
  const now = new Date();
  const entries: MetadataRoute.Sitemap = ["", "/for-students", "/for-residences", "/search", "/guias", "/nosotros"].map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now }));
  for (const g of getAllGuides()) entries.push({ url: `${SITE_URL}/guias/${g.slug}`, lastModified: now });
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return entries;
    const { data } = await admin.from("residences").select("slug, updated_at").eq("status", "verified_active");
    for (const r of data ?? []) {
      if (!r.slug) continue;
      // Residencias de demostración (slug «-demo»): nunca se indexan.
      if ((r.slug as string).endsWith("-demo")) continue;
      entries.push({
        url: `${SITE_URL}/residencias/${encodeURIComponent(r.slug as string)}`,
        ...(r.updated_at ? { lastModified: new Date(r.updated_at as string) } : {}),
      });
    }
  } catch (e) {
    console.error("[sitemap] no se pudieron leer las fichas:", e);
  }
  return entries;
}

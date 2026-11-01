import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = ["", "/for-students", "/for-residences", "/search"].map((p) => ({ url: `${SITE_URL}${p}` }));
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return entries;
    const { data } = await admin.from("residences").select("slug, updated_at").eq("status", "verified_active");
    for (const r of data ?? []) {
      if (!r.slug) continue;
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

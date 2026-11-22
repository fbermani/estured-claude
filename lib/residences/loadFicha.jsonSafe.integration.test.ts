import { describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadPublicFicha } from "@/lib/residences/loadFicha";
import { loadSharePreview } from "@/lib/residences/sharePreview";

/**
 * La ficha pública y la vista previa se guardan en el caché de Next (`unstable_cache`), que serializa a JSON. Si alguien suma un
 * `Map`, `Set`, `Date` o `undefined` al resultado, el caché lo cambiaría en silencio. Este test lo detecta.
 */
// Sin credenciales de Supabase (p. ej. CI) se saltea: necesita una residencia real.
describe.skipIf(!getSupabaseAdmin())("datos cacheados de la ficha pública", () => {
  it("sobreviven a un viaje por JSON sin cambiar", async () => {
    expect.hasAssertions();
    const admin = getSupabaseAdmin();
    if (!admin) return;
    const { data } = await admin.from("residences").select("slug").eq("status", "verified_active").limit(1).maybeSingle();
    if (!data?.slug) return;

    const ficha = await loadPublicFicha(data.slug as string);
    expect(ficha).not.toBeNull();
    expect(JSON.parse(JSON.stringify(ficha))).toEqual(ficha);

    const share = await loadSharePreview(data.slug as string);
    expect(share).not.toBeNull();
    expect(JSON.parse(JSON.stringify(share))).toEqual(share);
  }, 30_000);
});

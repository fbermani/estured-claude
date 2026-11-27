import { notFound } from "next/navigation";
import { SkipLink } from "@/components/ui/SkipLink";
import { isPreaperturaOn } from "@/lib/preapertura/flag";
import { AttributionCapture } from "@/components/analytics/AttributionCapture";
import { CookieNotice } from "@/components/analytics/CookieNotice";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { resolveMetaPixelId } from "@/lib/analytics/metaPixel";
import { pixelIdForViewer } from "@/lib/analytics/metaAudience";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSafeUser } from "@/lib/supabase/safe-get-user";
import "./preapertura.css";
import { Suspense } from "react";

/**
 * Layout de la preapertura (DR42.1): solo existe con `PREAPERTURA=on`; apagado, estas rutas dan 404 y la app queda como siempre.
 * Cada pantalla es un popup fijo sobre la landing real (blureada, en flujo normal) y acá van el enlace «Saltar al contenido» y el
 * `<main id="contenido">`. Los componentes de header/footer de preapertura (`components/preapertura/PreaperturaHeader|Footer`)
 * también reemplazan a la Navbar/Footer públicos en `(public)`.
 *
 * SOLO EN DESARROLLO se suma el navegador flotante «Pantallas (dev)». El `import()` está dentro de la rama `NODE_ENV === "development"`:
 * en el build de producción esa condición es falsa en tiempo de compilación y el componente ni se incluye.
 */
export default async function PreaperturaLayout({ children }: { children: React.ReactNode }) {
  if (!isPreaperturaOn()) notFound();
  const showDevNav = process.env.NODE_ENV === "development" || (process.env.NEXT_PUBLIC_STAGING === "on" && process.env.VERCEL_ENV !== "production");
  const DevScreenNav = showDevNav ? (await import("@/components/dev/DevScreenNav")).DevScreenNav : null;
  // La sesión se lee solo con el pixel configurado: un menor con cuenta no lo carga ni ve el aviso de cookies.
  const configuredPixelId = resolveMetaPixelId(process.env);
  let pixelId: string | null = null;
  if (configuredPixelId) {
    const supabase = await getSupabaseServer();
    const user = supabase ? await getSafeUser(supabase) : null;
    pixelId = await pixelIdForViewer(configuredPixelId, user?.id ?? null, getSupabaseAdmin());
  }
  return (
    <>
      <SkipLink />
      <AttributionCapture />
      <MetaPixel pixelId={pixelId} />
      {/* Fuera del contenido inerte y por encima del popup (z-70): ver `CookieNotice`. */}
      <CookieNotice pixelId={pixelId} />
      <main id="contenido">{children}</main>
      {/* `DevScreenNav` usa `useSearchParams`: sin Suspense falla el prerender del build (staging). */}
      {DevScreenNav && (
        <Suspense fallback={null}>
          <DevScreenNav />
        </Suspense>
      )}
    </>
  );
}

import type { NextConfig } from "next";

/** Host del proyecto de Supabase del entorno actual, o null si la URL falta o es inválida. */
function supabaseImageHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const nextConfig: NextConfig = {
  // DR28: el Centro de Guías lee `content/guias/*.md` con fs; hay que incluirlos en el bundle de Vercel.
  outputFileTracingIncludes: {
    "/guias": ["./content/guias/**/*"],
    "/guias/[slug]": ["./content/guias/**/*"],
    "/sitemap.xml": ["./content/guias/**/*"],
  },
  // docs/08 §3.1: la ruta oficial del detalle público es `/r/[slug]`; la ficha
  // real vive en `/residencias/[slug]` (auditoría 2026-10-20, H30).
  async redirects() {
    return [
      { source: "/r/:slug", destination: "/residencias/:slug", permanent: false },
      // Lista de espera de pre-lanzamiento retirada (H30): la página y los datos guardados siguen en el repo; para revertir, quitar esta línea.
      { source: "/waitlist", destination: "/search", permanent: false },
    ];
  },
  // Galería de fotos del perfil de residencia: cada foto (hasta 5 MB) viaja en una server action; el límite por defecto (1 MB) la cortaría.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  images: {
    // Fotos reales subidas a Supabase Storage (bucket público public-residence-media). Se fija el host EXACTO del
    // proyecto de cada entorno (sale de NEXT_PUBLIC_SUPABASE_URL): un comodín `*.supabase.co` dejaba el optimizador
    // de imágenes como proxy abierto para cualquier proyecto de Supabase ajeno.
    remotePatterns: supabaseImageHost()
      ? [{ protocol: "https", hostname: supabaseImageHost() as string, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Anti-clickjacking: la app no se embebe en iframes (ni propios).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

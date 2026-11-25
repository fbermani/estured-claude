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

/**
 * Preapertura (DR42, docs/23): con `PREAPERTURA=on` la entrada pública pasa a la versión de preapertura. Apagado, nada de esto aplica.
 * Se lee al arrancar/compilar: cambiar el flag exige reiniciar el dev server o volver a deployar. En desarrollo solo cambian `/` (popup)
 * y `/register/residence` (formulario de fundadoras); `/for-students`, `/register`, `/search`, `/waitlist` y
 * `/students/*` quedan como siempre. En producción (`PREAPERTURA_LOCKED`) esas también se cortan.
 * `/for-residences` y `/guias` NO se tocan (DR42.2–DR42.3). `/register/residence` conserva su URL: con el flag se reescribe al formulario
 * de preapertura (`/fundadoras/datos`, mismo formulario de 5 datos dentro del popup).
 */
const PREAPERTURA_ON = process.env.PREAPERTURA === "on";
/** En producción (preapertura «cerrada») el sitio abierto no es navegable; en desarrollo solo se suma el popup y sus pantallas. */
// El staging de Vercel (`NEXT_PUBLIC_STAGING=on`, solo Preview) se comporta como desarrollo: preapertura sin cortar el resto del sitio.
const DEV_UI = process.env.NODE_ENV === "development" || (process.env.NEXT_PUBLIC_STAGING === "on" && process.env.VERCEL_ENV !== "production");
const PREAPERTURA_LOCKED = PREAPERTURA_ON && !DEV_UI;

const IS_PROD = process.env.NODE_ENV === "production";
/**
 * Meta Pixel (Paso 0, «Medición»): sus orígenes solo entran a la CSP con el pixel realmente activo (ID válido y producción de Vercel).
 * Misma regla que `resolveMetaPixelId` (lib/analytics/metaPixel.ts); se repite acá porque la config no importa con el alias `@/`.
 */
const META_PIXEL_ON = /^\d{5,20}$/.test((process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim()) && process.env.VERCEL_ENV === "production";

/**
 * CSP en modo Report-Only (auditoría M5): todavía no se aplica. Orígenes externos reales (barrido de app/components/lib): Google Fonts
 * (hoja de Material Symbols + fuentes), tiles de OpenStreetMap del mapa de búsqueda (`<img>`) y el Supabase del entorno (fotos/comprobantes).
 * `unsafe-inline` en script por el script de sesión de app/layout.tsx y los inline de Next; `unsafe-eval` solo en dev (HMR).
 */
function contentSecurityPolicyReportOnly(): string {
  const supabase = supabaseImageHost();
  const supabaseOrigin = supabase ? ` https://${supabase}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${IS_PROD ? "" : " 'unsafe-eval'"} https://challenges.cloudflare.com${META_PIXEL_ON ? " https://connect.facebook.net https://www.facebook.com" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: https://tile.openstreetmap.org${supabaseOrigin}${META_PIXEL_ON ? " https://www.facebook.com" : ""}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self'${supabaseOrigin}${META_PIXEL_ON ? " https://connect.facebook.net https://www.facebook.com" : ""}${IS_PROD ? "" : " ws: wss:"}`,
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // S2: destino de las violaciones (route handler que solo loguea).
    "report-uri /api/csp-report",
  ].join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // DR61: web-push es CommonJS; cargarlo como paquete externo evita que el bundler pierda su export por defecto.
  serverExternalPackages: ["web-push"],
  // DR28: el Centro de Guías lee `content/guias/*.md` con fs; hay que incluirlos en el bundle de Vercel.
  outputFileTracingIncludes: {
    "/guias": ["./content/guias/**/*"],
    "/guias/[slug]": ["./content/guias/**/*"],
    "/sitemap.xml": ["./content/guias/**/*"],
  },
  // `beforeFiles`: `/` ya es una página real de `(public)`; sin esto la reescritura no le gana.
  async rewrites() {
    if (!PREAPERTURA_ON) return [];
    return {
      beforeFiles: [
        { source: "/", destination: "/preapertura" },
        ...(PREAPERTURA_LOCKED ? [{ source: "/for-students", destination: "/preapertura" }] : []),
        { source: "/register/residence", destination: "/fundadoras/datos" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // docs/08 §3.1: la ruta oficial del detalle público es `/r/[slug]`; la ficha
  // real vive en `/residencias/[slug]` (auditoría 2026-10-20, H30).
  async redirects() {
    return [
      ...(PREAPERTURA_LOCKED
        ? [
            // Exacto: `/register/residence`, `/register/family` y el resto de `/register/*` siguen funcionando.
            { source: "/register", destination: "/preregistro", permanent: false },
            { source: "/search", destination: "/preregistro", permanent: false },
            { source: "/waitlist", destination: "/preregistro", permanent: false },
            // DR42.3: el área de estudiante/familiar no existe en preapertura; «Mi lugar» es su único destino.
            { source: "/students/:path*", destination: "/mi-lugar", permanent: false },
          ]
        : []),
      { source: "/r/:slug", destination: "/residencias/:slug", permanent: false },
      // Lista de espera de pre-lanzamiento retirada (H30/DR31); el código se borró el 2026-11-12. El redirect queda para links viejos; la tabla `waitlist_signups` sigue.
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
          // El mapa usa tiles propios sobre OSM y no pide la ubicación del navegador (sin navigator.geolocation en el código).
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicyReportOnly() },
          ...(IS_PROD ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
      // `/preregistro?invitacion=<token>` lleva un token de un solo uso: que no salga en el Referer hacia ningún sitio. Va DESPUÉS de la regla
      // global: con la misma clave gana la última que coincide. (La página además lo declara en su metadata.)
      { source: "/preregistro", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;

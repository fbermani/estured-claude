import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // docs/08 §3.1: la ruta oficial del detalle público es `/r/[slug]`; la ficha
  // real vive en `/residencias/[slug]` (auditoría 2026-10-20, H30).
  async redirects() {
    return [{ source: "/r/:slug", destination: "/residencias/:slug", permanent: false }];
  },
  images: {
    remotePatterns: [
      {
        // Fotos reales subidas a Supabase Storage (bucket público
        // public-residence-media). Wildcard porque el subdominio del
        // proyecto varía por entorno (dev/staging/prod).
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;

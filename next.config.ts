import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Placeholder de los mocks del ciclo fundacional.
        protocol: "https",
        hostname: "picsum.photos",
      },
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

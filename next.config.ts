import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Placeholder images de picsum.photos para los mocks del primer ciclo.
  // Reemplazar por Supabase Storage cuando exista carga real de fotos.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;

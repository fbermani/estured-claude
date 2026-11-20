import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` fija la identidad de la app instalada aunque cambie `start_url` (DR61).
    id: "/",
    name: "EstuRed",
    short_name: "EstuRed",
    description: "Residencias estudiantiles verificadas en CABA.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Pantalla de carga (splash) al abrir la app instalada: verde de marca (= --color-forest-ink de globals.css; el manifest no admite tokens CSS).
    background_color: "#0c3a2c",
    theme_color: "#fbf6ec",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Versión con margen de seguridad para que Android recorte el ícono sin cortar el logo.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

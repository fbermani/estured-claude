import type { Metadata } from "next";
import { HomeLanding } from "@/components/marketing/HomeLanding";

// ISR (auditoría 2026-11-19, R19-04): la home no lee sesión (la Navbar la resuelve en el cliente) y el catálogo ya viene cacheado.
export const revalidate = 60;

// Solo canonical: title/description/OG vienen del layout raíz (la preapertura tiene su propia metadata).
export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Landing principal de EstuRed: el contenido vive en `components/marketing/HomeLanding.tsx` (lo reusa el fondo blureado de la preapertura). */
export default async function HomePage() {
  return <HomeLanding />;
}

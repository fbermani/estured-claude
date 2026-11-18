import type { Metadata } from "next";
import { HomeLanding } from "@/components/marketing/HomeLanding";

export const dynamic = "force-dynamic";

// Solo canonical: title/description/OG vienen del layout raíz (la preapertura tiene su propia metadata).
export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Landing principal de EstuRed: el contenido vive en `components/marketing/HomeLanding.tsx` (lo reusa el fondo blureado de la preapertura). */
export default async function HomePage() {
  return <HomeLanding />;
}

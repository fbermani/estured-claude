import { HomeLanding } from "@/components/marketing/HomeLanding";

export const dynamic = "force-dynamic";

/** Landing principal de EstuRed: el contenido vive en `components/marketing/HomeLanding.tsx` (lo reusa el fondo blureado de la preapertura). */
export default async function HomePage() {
  return <HomeLanding />;
}

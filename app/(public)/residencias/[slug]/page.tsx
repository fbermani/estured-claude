import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FichaView } from "@/components/residences/ficha/FichaView";
import { loadPublicFicha } from "@/lib/residences/loadFicha";

export const dynamic = "force-dynamic";

// La carga de datos vive en `lib/residences/loadFicha.ts` y el render en `components/residences/ficha/FichaView.tsx`: los comparte la
// vista previa del equipo (`/residence/[id]/preview`). Esta ficha pública solo muestra residencias `verified_active` (404 en cualquier otro caso).

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicFicha(slug);
  if (!data) return { title: "Residencia no encontrada", robots: { index: false, follow: false } };
  const { residence } = data;
  const zone = (residence.public_area as string | null)?.trim();
  const description = zone
    ? `${residence.name}: residencia estudiantil verificada en ${zone}, CABA. Mirá fotos, servicios y reglas, y enviá tu solicitud.`
    : `${residence.name}: residencia estudiantil verificada en CABA. Mirá fotos, servicios y reglas, y enviá tu solicitud.`;
  const path = `/residencias/${slug}`;
  // La imagen de vista previa (og:image) la genera `opengraph-image.tsx` (placa + precio «desde» + sello); Next la agrega sola.
  return {
    title: residence.name,
    description,
    alternates: { canonical: path },
    // Fichas de demostración (slug «-demo»): nunca se indexan.
    ...(slug.endsWith("-demo") ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: "website",
      siteName: "EstuRed",
      locale: "es_AR",
      url: path,
      title: residence.name,
      description,
    },
    twitter: { card: "summary_large_image", title: residence.name, description },
  };
}

export default async function RealResidenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ room?: string; solicitar?: string }>;
}) {
  const { slug } = await params;
  const { room: preselectedRoomTypeId, solicitar } = await searchParams;
  const data = await loadPublicFicha(slug);
  if (!data) notFound();
  return <FichaView data={data} slug={slug} preselectedRoomTypeId={preselectedRoomTypeId} solicitar={solicitar} />;
}

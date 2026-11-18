import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/pageMeta";
import { ResidencesLanding } from "@/components/marketing/ResidencesLanding";

export const metadata: Metadata = pageMetadata({
  title: "Publicá tu residencia estudiantil",
  description:
    "EstuRed no reemplaza tu operación. La ordena, la hace más clara y te ayuda a convertir mejores solicitudes.",
  path: "/for-residences",
});

/** Landing de residencias: el contenido vive en `components/marketing/ResidencesLanding.tsx` (lo reusa el fondo blureado de fundadoras). */
export default function ForResidencesPage() {
  return <ResidencesLanding />;
}

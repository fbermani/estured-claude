import type { Metadata } from "next";
import { ResidencesLanding } from "@/components/marketing/ResidencesLanding";

export const metadata: Metadata = {
  title: "Para residencias",
  description:
    "EstuRed no reemplaza tu operación. La ordena, la hace más clara y te ayuda a convertir mejores solicitudes.",
};

/** Landing de residencias: el contenido vive en `components/marketing/ResidencesLanding.tsx` (lo reusa el fondo blureado de fundadoras). */
export default function ForResidencesPage() {
  return <ResidencesLanding />;
}

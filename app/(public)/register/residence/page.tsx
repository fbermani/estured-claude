import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Sumar mi residencia" };

export default function RegisterResidencePage() {
  return (
    <ComingSoon
      title="Alta de residencias: muy pronto"
      description="Estamos onboardeando a las residencias pioneras de forma personalizada, con verificación presencial incluida. Dejanos tus datos en la lista de espera y te contactamos para coordinar."
    />
  );
}

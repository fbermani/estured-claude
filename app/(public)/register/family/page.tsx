import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Cuenta de familiar" };

export default function RegisterFamilyPage() {
  return (
    <ComingSoon
      title="Cuenta de familiar: muy pronto"
      description="Las cuentas de familiares —con vinculación aprobada por el estudiante, propuestas y seguimiento— se habilitan en la próxima etapa. Mientras tanto, el estudiante puede crear su cuenta y vos podés sumarte a la lista de espera para recibir novedades."
    />
  );
}

import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Panel de residencia" };

/**
 * Placeholder del panel multi-residencia (docs/08 §7). Se construye en
 * el ciclo de onboarding de residencias, junto con el alta y la
 * verificación. El layout ya valida rol residence_owner/staff.
 */
export default function ResidenceDashboardPage() {
  return (
    <ComingSoon
      title="Panel de tu residencia"
      description="Acá vas a gestionar perfil, disponibilidad, solicitudes, lista de espera y renovaciones. El onboarding de residencias pioneras se está coordinando de forma personalizada."
    />
  );
}

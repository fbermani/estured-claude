import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Admin EstuRed" };

/**
 * Placeholder del panel admin (docs/09, docs/11 §7.4).
 * Se construye con auth, roles y auditoría en fases posteriores.
 * Sin navbar pública: el admin tendrá su propio layout interno.
 */
export default function AdminDashboardPage() {
  return (
    <ComingSoon
      title="Panel de administración"
      description="El panel interno de EstuRed (verificaciones, solicitudes, pagos, auditoría) se construye junto con autenticación y roles."
    />
  );
}
